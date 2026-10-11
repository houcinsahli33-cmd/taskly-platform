'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),express=require('express');
const root=path.join(__dirname,'..');
const pages=require('../server/routes/workspacePages').pages;
test('18 pages autonomes : statistiques seulement sur accueil, un contenu par fichier',()=>{
 let count=0;
 for(const [role,names] of Object.entries(pages))for(const page of names){
  count++;const html=fs.readFileSync(path.join(root,'client/private',role,page+'.html'),'utf8');
  assert.match(html,new RegExp('data-workspace-page="'+page+'"'));
  assert.match(html,/workspace-pro.css/);assert.doesNotMatch(html,/dashboard-pages.js|href="#demandes"/);
  if(role==='admin'){
   const sections=[...html.matchAll(/id="admin-(overview|users|reports|contacts|services|verification|account|admins|site)"/g)].map(m=>m[1]);
   assert.deepEqual(sections,[page]);
   assert.equal(html.includes('id="admin-stats-grid"'),page==='overview');
  }else{
   assert.equal(html.includes('id="'+role+'-stats"'),page==='accueil');
   assert.equal(html.includes('id="account-profile-editor"'),page==='profil');
   assert.equal(html.includes('id="'+role+'-requests"'),page==='demandes');
   assert.equal(html.includes('id="contact-form"'),page==='support');
  }
 }
 assert.equal(count,18);
});
function appFor(role,niveau='secondaire'){
 const module={exports:{}};
 const mocks={
  '../middleware/authMiddleware':{
   verifierConnexion:(req,res,next)=>role?next():res.status(401).send('Connexion requise.'),
   verifierAdmin:(req,res,next)=>role==='admin'?next():res.status(403).send('Accès refusé.')
  },
  '../config/db':{promise:()=>({query:async()=>[[{niveau}]]})}
 };
 vm.runInNewContext(fs.readFileSync(path.join(root,'server/routes/workspacePages.js'),'utf8'),{module,require:n=>mocks[n]||require(n),__dirname:path.join(root,'server/routes')});
 const app=express();app.use((req,res,next)=>{req.session={utilisateur:{id:7,role}};next();});
 module.exports(app,{adminEntryPath:'/prive-test',headersAdminPrive:(req,res,next)=>next()});
 app.use((req,res)=>res.status(404).end());return app;
}
test('routes dédiées : page avis seule, profils et rôles protégés',async()=>{
 const send=require('./helpers/request');
 const rep=await send(appFor('artisan'),'/espace/artisan/avis');assert.equal(rep.status,200);
 const html=await rep.text();assert.match(html,/id="artisan-reviews-dashboard"/);assert.doesNotMatch(html,/id="artisan-stats"|id="account-profile-editor"/);
 assert.equal((await send(appFor(null),'/espace/artisan/profil')).status,401);
 assert.equal((await send(appFor('client'),'/espace/artisan/profil')).status,403);
 assert.equal((await send(appFor('client'),'/espace/client/avis')).status,404);
 const legacy=await send(appFor('artisan'),'/artisan-dashboard.html?page=avis');assert.equal(legacy.status,302);assert.equal(legacy.headers.get('location'),'/espace/artisan/avis');
});
test('routes admin : principal requis pour site et administrateurs',async()=>{
 const send=require('./helpers/request');
 for(const page of ['site','admins']){
  assert.equal((await send(appFor('admin','secondaire'),'/prive-test/dashboard/'+page)).status,403);
  assert.equal((await send(appFor('admin','principal'),'/prive-test/dashboard/'+page)).status,200);
 }
 assert.equal((await send(appFor('client'),'/prive-test/dashboard/users')).status,403);
 assert.equal((await send(appFor(null),'/prive-test/dashboard/users')).status,401);
 const legacy=await send(appFor('admin'),'/prive-test/dashboard?page=verification');assert.equal(legacy.headers.get('location'),'/prive-test/dashboard/verification');
});
test('page Avis : le script ne charge aucune demande ni statistique',async()=>{
 const callbacks={};const calls=[];
 const document={body:{dataset:{workspacePage:'avis'}},addEventListener:(n,fn)=>{callbacks[n]=fn;},getElementById:()=>({textContent:''})};
 const sandbox={document,window:{utilisateurCourant:{role:'artisan'}},attendreSession:async()=>{},requeteAPI:async url=>{calls.push(url);return url==='/api/account'?{compte:{artisan_id:15}}:{avis:[],statistiques:{}};},etatChargement:()=>'',etatVide:()=>'',console};
 vm.runInNewContext(fs.readFileSync(path.join(root,'client/public/js/artisan-dashboard.js'),'utf8'),sandbox);
 await callbacks.DOMContentLoaded();assert.deepEqual(calls,['/api/account','/api/avis/artisan/15']);
});
test('admin Mon compte : aucun chargement des autres rubriques',async()=>{
 let ready;const sandbox={document:{body:{dataset:{workspacePage:'account'}},addEventListener:(n,fn)=>{ready=fn;},querySelectorAll:()=>[]},window:{utilisateurCourant:{role:'admin'}},attendreSession:async()=>{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'client/public/js/admin-dashboard.js'),'utf8'),sandbox);
 const calls=[];for(const name of ['chargerStatsAdmin','chargerUtilisateursAdmin','chargerSignalementsAdmin','chargerContactsAdmin','chargerServicesAdmin'])sandbox[name]=()=>calls.push(name);
 sandbox.initialiserActionsAdmin=()=>{};await ready();assert.deepEqual(calls,[]);
});
