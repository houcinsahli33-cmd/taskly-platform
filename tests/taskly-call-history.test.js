'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const uuid = '3f3479fa-77e8-4a91-b58a-c32e8e5c8888';
function mockService() {
 const queries=[];
 const file=path.join(root,'server/services/chatCallHistory.js');
 const mod=new Module(file,module);
 mod.filename=file;
 mod.paths=module.paths;
 const db={promise:()=>({query:async(sql,args)=>{queries.push({sql,args}); return [[],{}];}})};
 mod.require=id=>id==='../config/db'?db:require(id);
 mod._compile(fs.readFileSync(file,'utf8'),file);
 return {svc:mod.exports,queries};
}
function example(overrides={}) {
 return {code:201,call:{id:uuid,callerRole:'client',mode:'audio',state:'ringing',startedAt:Date.now(),...overrides}};
}
test('Historique : démarrage persiste uniquement les métadonnées', async()=>{
 const {svc,queries}=mockService();
 assert.equal(await svc.enregistrerTransition({demandeId:100,role:'client'},'start',example()),true);
 assert.equal(queries.length,1);
 assert.match(queries[0].sql,/INSERT IGNORE INTO taskly_call_history/);
 assert.equal(queries[0].args[0],uuid);
 assert.equal(queries[0].args[1],100);
 assert.equal(queries[0].args[2],'client');
 assert(!queries[0].sql.includes('sdp')&&!queries[0].sql.includes('token'));
});
test('Historique : acceptation, fin, refus et appel manqué sont distincts', async()=>{
 const {svc,queries}=mockService();
 const t=Date.now();
 await svc.enregistrerTransition({demandeId:100,role:'artisan'},'accept',{code:400,call:example({acceptedAt:t+3000}).call});
 assert.equal(queries.length,0,'code 201 doit être dans result, pas call');
 await svc.enregistrerTransition({demandeId:100,role:'artisan'},'accept',{code:200,call:example({state:'accepted',acceptedAt:t+3000}).call});
 assert.match(queries[1].sql,/etat='answered'/);
 await svc.enregistrerTransition({demandeId:100,role:'client'},'end',{code:200,call:example({state:'ended',acceptedAt:t+3000,endedAt:t+9000}).call});
 assert.match(queries[3].sql,/etat=\?/);
 assert.equal(queries[3].args[0],'completed');
 await svc.enregistrerTransition({demandeId:100,role:'artisan'},'reject',{code:200,call:example({state:'rejected',endedAt:t+9000}).call});
 assert.match(queries[5].sql,/etat='declined'/);
 await svc.enregistrerTransition({demandeId:100,role:'client'},'end',{code:200,call:example({state:'ended',endedAt:t+9000}).call});
 assert.equal(queries[7].args[0],'cancelled');
});
test('Historique : identifiant invalide ou rôle non autorisé, aucune requête',async()=>{
 const {svc,queries}=mockService();
 assert.equal(await svc.enregistrerTransition({demandeId:100,role:'admin'},'start',example()),false);
 assert.equal(await svc.enregistrerTransition({demandeId:0,role:'client'},'start',example()),false);
 assert.equal(await svc.enregistrerTransition({demandeId:100,role:'client'},'start',example({id:'bad'})),false);
 assert.equal(await svc.enregistrerTransition({demandeId:100,role:'client'},'start',example({mode:'screen'})),false);
 assert.equal(queries.length,0);
});
test('Historique : lecture limitée à la demande avec limite 50',async()=>{
 const {svc,queries}=mockService();
 await svc.listerPourDemande(101);
 assert.match(queries[0].sql,/WHERE demande_id=\?/);
 assert.match(queries[0].sql,/LIMIT 50/);
 assert.match(queries[0].sql,/INTERVAL 90 SECOND/);
 assert.deepEqual(queries[0].args,[101]);
 await assert.rejects(svc.listerPourDemande('abc'),/invalide/);
});
test('Historique : endpoint protégé par vérification du participant et lecture autorisée',()=>{
 const ctrl=read('server/controllers/chatController.js');
 const routes=read('server/routes/demandeRoutes.js');
 const block=ctrl.match(/async function historiqueAppels\([\s\S]*?\n\}\n\nmodule\.exports/);
 assert(block);
 assert.match(block[0],/verifierParticipant\(req, res\)/);
 assert.match(block[0],/historiqueAutorise\(acces.demande\)/);
 assert.match(routes,/TASKLY_CHAT_CALL_HISTORY_ENABLED/);
 assert.match(routes,/router\.get\('\/:id\/chat\/calls\/history',verifierConnexion/);
 assert.match(routes,/chatController\.historiqueAppels/);
});
test('Historique : aucune modification des routes LiveKit, et état activé uniquement par variable',()=>{
 const ctrl=read('server/controllers/chatController.js');
 assert.match(ctrl,/TASKLY_CHAT_CALL_HISTORY_ENABLED === 'true'/);
 assert.match(ctrl,/result\.call && \[200,201\]\.includes\(result\.code\)/);
 assert.match(ctrl,/Historique Taskly : ecriture indisponible/);
 const ui=read('client/public/js/taskly-call-history.js');
 assert.match(ui,/function merge\(messages, calls\)/);
 assert.match(ui,/function presentation\(call, role\)/);
 assert.match(ui,/TasklyCallHistory/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|mediaDevices|RTCPeerConnection/);
});
test('Historique : intégré aux deux messageries sans changer la grille',()=>{
 for (const role of ['client','artisan']) {
  const html=read('client/private/'+role+'/messagerie.html');
  assert.match(html,/taskly-call-history\.css\?v=3/);
  assert.match(html,/taskly-call-history\.js\?v=3/);
 }
 const css=read('client/public/css/taskly-call-history.css');
 assert.match(css,/\.cw-call-event/);
 assert.doesNotMatch(css,/\.cw-grid\s*\{/);
 const ws=read('client/public/js/taskly-chat-workspace.js');
 assert.match(ws,/refreshCallHistory\(id,my\)/);
});

test('API : un utilisateur extérieur à la demande ne lit jamais les appels',async()=>{
 const vm=require('node:vm');
 const src=read('server/controllers/chatController.js');
 let reads=0;
 const fake={
  '../models/chatModel':{trouverDemande:async()=>({id:100,client_id:10,artisan_id:20,statut:'acceptee'})},
  '../models/clientModel':{trouverClientParUserId:async id=>({id:id===42?10:99})},
  '../models/artisanModel':{trouverArtisanParUserId:async()=>({id:20,verification_statut:'approuve'})},
  '../services/chatCallPilot':{},
  '../services/chatCallHistory':{listerPourDemande:async()=>{reads++;return [{id:uuid}];}}
 };
 const sandbox={module:{exports:{}},console:{error(){}},require(id){if(!fake[id])throw Error('unexpected require: '+id);return fake[id];},process:{env:{}}};
 vm.runInNewContext(src,sandbox,{filename:'chatController.js'});
 const res=()=>({statusCode:200,body:null,set(){return this;},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}});
 const req=id=>({params:{id:'100'},session:{utilisateur:{id,role:'client'}}});
 const denied=res();await sandbox.module.exports.historiqueAppels(req(99),denied);
 assert.equal(denied.statusCode,404);assert.equal(reads,0);
 const allowed=res();await sandbox.module.exports.historiqueAppels(req(42),allowed);
 assert.equal(allowed.statusCode,200);assert.equal(reads,1);assert.equal(allowed.body.appels.length,1);
});

test('API : historique indisponible pour demande jamais acceptée',async()=>{
 const vm=require('node:vm');
 let reads=0;
 const fake={
  '../models/chatModel':{trouverDemande:async()=>({id:101,client_id:10,artisan_id:20,statut:'en_attente'})},
  '../models/clientModel':{trouverClientParUserId:async()=>({id:10})},
  '../models/artisanModel':{},'../services/chatCallPilot':{},
  '../services/chatCallHistory':{listerPourDemande:async()=>{reads++;return [];}}
 };
 const sandbox={module:{exports:{}},console:{error(){}},require(id){if(!fake[id])throw Error(id);return fake[id];},process:{env:{}}};
 vm.runInNewContext(read('server/controllers/chatController.js'),sandbox);
 const res={code:200,set(){return this;},status(n){this.code=n;return this;},json(){return this;}};
 await sandbox.module.exports.historiqueAppels({params:{id:'101'},session:{utilisateur:{id:42,role:'client'}}},res);
 assert.equal(res.code,403);assert.equal(reads,0);
});
