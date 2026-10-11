'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function mockDossier(signaleurUserId,signaleUserId,statut='annulee') {
 const queries=[];
 const signalement={id:18,demande_id:142,signaleur_user_id:signaleurUserId,signale_user_id:signaleUserId,statut:'nouveau'};
 const demande={id:142,client_id:9,artisan_id:16,client_user_id:91,artisan_user_id:104,statut,annulee_par:'client',motif_annulation:'Je ne souhaite plus ce travail',date_annulation:'2026-10-10 09:30:00',message:'Demande réelle'};
 const results=[[[signalement]],[[]],[[]],[[demande]]];
 const db={promise:()=>({query:async(sql,params)=>{queries.push({sql,params});return results.shift();}})};
 const module={exports:{}};
 vm.runInNewContext(read('server/models/adminSignalementsModel.js'),{require:name=>{assert.equal(name,'../config/db');return db;},module,console,Number,Map,Set,Object});
 return module.exports.dossier(18).then(result=>({result,queries}));
}

test('Signalement : Voir les détails charge la demande liée et son annulation',async()=>{
 const {result,queries}=await mockDossier(91,104);
 assert.equal(queries.length,4);
 assert.deepEqual(Array.from(queries[3].params),[142]);
 assert.match(queries[3].sql,/JOIN clients c ON c\.id=d\.client_id/);
 assert.match(queries[3].sql,/JOIN artisans a ON a\.id=d\.artisan_id/);
 assert.match(queries[3].sql,/d\.annulee_par,d\.motif_annulation,d\.date_annulation/);
 assert.match(queries[3].sql,/WHERE d\.id=\? LIMIT 1/);
 assert.equal(result.demande.statut,'annulee');
 assert.equal(result.demande.annulee_par,'client');
 assert.equal(result.correspondance.confirme,true);
 assert.equal(result.correspondance.signaleur_est_client,true);
});

test('Signalement : les deux sens client/artisan sont valides',async()=>{
 const {result}=await mockDossier(104,91,'acceptee');
 assert.equal(result.correspondance.confirme,true);
 assert.equal(result.correspondance.signaleur_est_artisan,true);
 assert.equal(result.demande.statut,'acceptee');
});

test('Signalement : une personne hors demande ne doit pas être confirmée',async()=>{
 const {result}=await mockDossier(91,700);
 assert.equal(result.correspondance.confirme,false);
 assert.equal(result.correspondance.signale_est_artisan,false);
});

test('Signalements : Voir les détails expose les vrais statuts, motif et historique de dates',()=>{
 const ui=read('client/public/js/admin-reports-page.js');
 assert.match(ui,/Voir les détails/);
 assert.match(ui,/correspondance\?\.confirme/);
 assert.match(ui,/demande\.annulee_par==='client'/);
 assert.match(ui,/demande\.motif_annulation/);
 assert.match(ui,/demande\.date_annulation/);
 assert.match(ui,/demande\.date_traitement/);
 assert.match(ui,/Vérifiez l'identité du client/);
 assert.doesNotMatch(ui,/Aperçu · Données de démonstration/);
});

test('Signalements : page indépendante, même barre latérale, route protégée',()=>{
 const page=read('client/private/admin/reports.html');
 const users=read('client/private/admin/users.html');
 const nav = text=>text.match(/<aside class="admin-sidebar"[\s\S]*?<\/aside>/)?.[0];
 const nettoyerNavigation = html => nav(html).replace(/\s*class="active" aria-current="page"/g,'');
 assert.equal(nettoyerNavigation(page),nettoyerNavigation(users));
 assert.match(page,/admin-reports-page\.js/);
 const routes=read('server/routes/adminRoutes.js');
 assert.ok(routes.indexOf('router.use(verifierConnexion, verifierAdmin)') < routes.indexOf('router.get("/signalements/:id"'));
});

test('Signalements : Examiner charge la vraie demande et propose de vérifier une annulation',async()=>{
 const elements=new Map();
 const get=id=>{
  if(!elements.has(id))elements.set(id,{
   id,innerHTML:'',textContent:'',hidden:true,disabled:false,dataset:{},listeners:{},
   classList:{add(){},remove(){},toggle(){}},
   addEventListener(type,listener){this.listeners[type]=listener;},
   setAttribute(){},querySelector(){return {focus(){}};},querySelectorAll(){return [];},focus(){}
  });
  return elements.get(id);
 };
 const calls=[];let ready;
 const dossier={
  signalement:{id:18,demande_id:142,motif:'Retard',description:'Pas venu',created_at:'2026-10-10',statut:'nouveau',priorite:'haute',signaleur_user_id:91,signale_user_id:104,signaleur_role:'client',signale_role:'artisan',signaleur_nom:'Client',signale_nom:'Artisan',signaleur_email:'test@example.com',signale_statut_compte:'actif'},
  demande:{id:142,statut:'annulee',annulee_par:'client',motif_annulation:'Plus nécessaire',date_annulation:'2026-10-10',client_user_id:91,artisan_user_id:104},
  correspondance:{confirme:true},notifications:[]
 };
 const sandbox={
  document:{activeElement:{focus(){}},body:{dataset:{workspacePage:'reports'},classList:{add(){},remove(){}}},getElementById:get,querySelectorAll:()=>[],addEventListener:(n,fn)=>{ready=fn;}},
  window:{utilisateurCourant:{role:'admin'},location:{pathname:'/acces-prive-test/dashboard/reports'}},
  attendreSession:async()=>{},echapperHTML:x=>String(x??'').replaceAll('<','&lt;'),
  formatDate:x=>x,formatDateHeure:x=>x,adminSignalements:[],
  requeteAPI:async url=>{
   calls.push(url);
   if(url.startsWith('/api/admin/signalements?'))return {signalements:[dossier.signalement],compteurs:{total:1,nouveau:1,non_traite:0,en_cours:0,traite:0},page:1,pages:1,total:1};
   if(url==='/api/admin/signalements/18')return dossier;
   throw new Error('Unexpected request: '+url);
  },setTimeout,clearTimeout,URLSearchParams,Date,Number,String,console
 };
 vm.runInNewContext(read('client/public/js/admin-reports-page.js'),sandbox);
 await ready();
 await new Promise(r=>setImmediate(r));
 assert.match(get('reports-table').innerHTML,/data-report-examine="18"/);
 get('reports-table').listeners.click({target:{closest:selector=>selector==='[data-report-examine]'?{dataset:{reportExamine:'18'}}:null}});
 await new Promise(r=>setImmediate(r));
 assert.ok(calls.includes('/api/admin/signalements/18'));
 assert.match(get('reports-dialog-root').innerHTML,/Voir les détails/);
 assert.match(get('reports-dialog-root').innerHTML,/Demande annulée par le client/);
 assert.match(get('reports-dialog-root').innerHTML,/Identités reliées à cette demande/);
});
