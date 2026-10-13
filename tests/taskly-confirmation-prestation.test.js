'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function controller({affected=1,valid=true}={}){
 const mails=[];let tokens=0;
 const mocks={
  '../models/demandeModel':{
   terminerDemande:async()=>({affectedRows:affected}),
   confirmerFinClient:async()=>({affectedRows:affected}),
   contesterFinClient:async()=>({affectedRows:affected}),
   trouverDestinataires:async()=>({client_user_id:10,client_email:'client@example.test',artisan_prenom:'Sara',artisan_nom:'Test'})},
  '../models/clientModel':{trouverClientParUserId:async()=>({id:11})},
  '../models/artisanModel':{trouverArtisanParUserId:async()=>({id:12})},
  '../services/tasklyConfirmation':{creer:async()=>{tokens++;return '1'.repeat(64);},confirmer:async()=>valid},
  '../services/tasklyMail':{base:()=> 'https://taskly.example.test',mettreEnFile:async mail=>mails.push(mail),traiterLot:async()=>{}}
 };
 const m={exports:{}};
 const source=fs.readFileSync(path.join(root,'server/controllers/demandeController.js'),'utf8');
 vm.runInNewContext('(function(require,module,exports){'+source+'\n})',{console})(k=>{if(!(k in mocks))throw new Error('Unknown dependency '+k);return mocks[k];},m,m.exports);
 return {c:m.exports,mails,count:()=>tokens};
}
function response(){return {statusCode:200,data:{},status(code){this.statusCode=code;return this},set(){return this},json(data){this.data=data;return this}};}
const req={session:{utilisateur:{id:7}},params:{id:'9'},body:{token:'1'.repeat(64)}};
test('artisan clôture : demande de confirmation, e-mail seulement au client',async()=>{
 const {c,mails,count}=controller();const res=response();await c.terminerDemande(req,res);
 assert.equal(res.statusCode,200);assert.match(res.data.message,/attente de confirmation/);assert.equal(count(),1);
 assert.equal(mails.length,1);assert.equal(mails[0].to,'client@example.test');
 assert.match(mails[0].link,/confirmation-prestation\.html\?demande=9#token=/);
 assert.match(mails[0].secondaryLink,/signalement-prestation.html\?demande=9/);
});
test('demande ne pouvant être clôturée : aucun jeton ni e-mail',async()=>{
 const {c,mails,count}=controller({affected:0});const res=response();await c.terminerDemande(req,res);
 assert.equal(res.statusCode,400);assert.equal(count(),0);assert.equal(mails.length,0);
});
test('confirmation et contestation depuis le compte client passent par vérification de propriété',async()=>{
 const {c}=controller();for(const method of ['confirmerFinClient','contesterFinClient']){
  const res=response();await c[method](req,res);assert.equal(res.statusCode,200);
 }
 const {c:denied}=controller({affected:0});const r=response();await denied.contesterFinClient(req,r);assert.equal(r.statusCode,409);
});
test('le lien e-mail invalide, expiré ou consommé n’accepte pas la confirmation',async()=>{
 const {c}=controller({valid:false});const res=response();await c.confirmerDepuisEmail(req,res);assert.equal(res.statusCode,409);
});
test('les routes confirment le rôle client pour les actions compte',()=>{
 const routes=fs.readFileSync(path.join(root,'server/routes/demandeRoutes.js'),'utf8');
 assert.match(routes,/router.put\('\/:id\/confirmer-fin', verifierConnexion, verifierClient/);
 assert.match(routes,/router.put\('\/:id\/contester-fin', verifierConnexion, verifierClient/);
 assert.match(routes,/router.post\('\/confirmation-lien'.*limiter/);
});
test('formulaire signalement reste lié au compte et n’est pas soumis automatiquement',()=>{
 const c=fs.readFileSync(path.join(root,'client/public/js/client-dashboard.js'),'utf8');
 const src=fs.readFileSync(path.join(root,'client/public/js/taskly-report-access.js'),'utf8');
 assert.match(c,/demandesClient\.some\(d=>Number\(d\.id\)===requested\)/);
 assert.match(c,/data-not-finished/);
 assert.match(src,/tasklyReportPending/);
 assert.doesNotMatch(src,/\/api\/signalements/);
});
