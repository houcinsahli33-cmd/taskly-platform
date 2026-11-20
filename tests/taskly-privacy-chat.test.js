"use strict";
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const source=fs.readFileSync('server/controllers/chatController.js','utf8');
function fixture(blocked,role='client'){
 let sends=0,calls=0;const d={id:7,client_id:11,artisan_id:22,statut:'acceptee',messagerie_bloquee:blocked};
 const chat={trouverDemande:async()=>d,listerMessages:async()=>[{id:'1',contenu:'Historique'}],envoyerMessage:async()=>{sends++;return 8;},participantsAppelActifs:async()=>true};
 const dependencies={'../models/chatModel':chat,'../services/chatCallPilot':{autoriseCompte:()=>true,autoriseDemande:()=>true,modeGeneral:()=>true},'../models/clientModel':{trouverClientParUserId:async()=>({id:11})},'../models/artisanModel':{trouverArtisanParUserId:async()=>({id:22,verification_statut:'approuve'})},'../services/chatCallService':{signaler:async()=>{calls++;return {code:200,call:null}}},'../services/chatCallInbox':{invitations:async()=>[{id:'abc',demandeId:7,clientId:11,artisanId:22}]}};
 const module={exports:{}};vm.runInNewContext(source,{module,require:n=>{assert.ok(dependencies[n],n);return dependencies[n]},console});
 const req={session:{utilisateur:{role,id:1}},params:{id:'7'},method:'POST',body:{contenu:'Bonjour',action:'start'}};
 const res={code:200,set(){},status(n){this.code=n;return this},json(x){this.data=x;return this}};
 return {api:module.exports,req,res,sends:()=>sends,calls:()=>calls};
}
for(const role of ['client','artisan']) test('Confidentialite : historique conservé, envoi et appel bloqués '+role,async()=>{const f=fixture(1,role);await f.api.lireChat(f.req,f.res);assert.equal(f.res.data.lectureSeule,true);assert.equal(f.res.data.messages.length,1);await f.api.envoyerChat(f.req,f.res);assert.equal(f.res.code,403);assert.equal(f.sends(),0);for(const action of ['start','accept','heartbeat']){f.req.body.action=action;await f.api.gererAppel(f.req,f.res);assert.equal(f.res.code,403);}assert.equal(f.calls(),0);});
test('Confidentialite : envoi autorisé selon les droits existants',async()=>{const f=fixture(0);await f.api.envoyerChat(f.req,f.res);assert.equal(f.res.code,201);assert.equal(f.sends(),1);});
test('Confidentialite : notification masquée et lecture appel vide',async()=>{const f=fixture(1);await f.api.appelsEntrants(f.req,f.res);assert.equal(f.res.data.appels.length,0);f.req.method='GET';await f.api.gererAppel(f.req,f.res);assert.equal(f.res.data.call,null);assert.equal(f.calls(),0);});
test('Confidentialite : insertion SQL protégée et préférence enregistrée',()=>{const model=fs.readFileSync('server/models/chatModel.js','utf8');assert.match(model,/EXISTS \(SELECT 1 FROM artisans a WHERE a.id=d.artisan_id AND a.autoriser_messagerie=1\)/);const route=fs.readFileSync('server/routes/accountRoutes.js','utf8');assert.match(route,/!\[0, 1\]\.includes\(b.autoriser_messagerie\)/);assert.match(route,/autoriser_messagerie = \?/);});