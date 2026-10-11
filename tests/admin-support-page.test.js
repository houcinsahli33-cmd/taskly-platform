'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function charge(file,mocks){const m={exports:{}};vm.runInNewContext(read(file),{module:m,console,require:name=>name in mocks?mocks[name]:require(name),Number,String,Set,Map,Date,Error,Object,process},{filename:file});return m.exports;}
function response(){return {code:200,body:null,status(n){this.code=n;return this},json(x){this.body=x;return this}};}
test('Support : meme barre laterale que Signalements et seulement Support actif',()=>{
 const nav=x=>x.match(/<aside class="admin-sidebar"[\s\S]*?<\/aside>/)?.[0].replace(/\s*class="active" aria-current="page"/g,'');
 assert.equal(nav(read('client/private/admin/contacts.html')),nav(read('client/private/admin/reports.html')));
 assert.match(read('client/private/admin/contacts.html'),/class="active" aria-current="page" data-admin-tab="contacts"/);
 assert.match(read('client/private/admin/contacts.html'),/admin-support-page\.js/);
 assert.doesNotMatch(read('client/private/admin/contacts.html'),/admin-dashboard\.js/);
});
test('Support : API admin protege par les middlewares existants',()=>{
 const routes=read('server/routes/adminRoutes.js');
 assert.ok(routes.indexOf('router.use(verifierConnexion, verifierAdmin)')<routes.indexOf("router.get('/support/messages'"));
 assert.match(routes,/router\.post\('\/support\/messages\/:id\/reponses',require\('\.\.\/middleware\/securityMiddleware'\)\.limiter/);
});
test('Support : recherches et statuts strictement limites',()=>{
 const model=charge('server/models/adminSupportModel.js',{'../config/db':{}});
 assert.equal(model.parametresListe({statut:'en_cours',page:'3'}).page,3);
 assert.equal(model.parametresListe({}).taille,10);
 assert.throws(()=>model.parametresListe({statut:"traite'; DROP TABLE users"}),{status:400});
 assert.throws(()=>model.parametresListe({tri:'SELECT'}),{status:400});
 assert.equal(model.idValide('2 OR 1=1'),null);
});
test('Support : recherche paginee avec requetes parametrees, vrais compteurs',async()=>{
 const queries=[];
 const db={promise:()=>({query:async(sql,args)=>{
   queries.push({sql,args});
   if(sql.includes('GROUP BY statut'))return [[{statut:'nouveau',total:2},{statut:'traite',total:3}]];
   if(sql.includes('COUNT(*) AS total FROM contacts_support'))return [[{total:2}]];
   if(sql.includes('SELECT c.id,c.sujet'))return [[{id:4,sujet:'Question'}]];
   throw Error('sql inattendu:'+sql);
 }})};
 const model=charge('server/models/adminSupportModel.js',{'../config/db':db});
 const value=await model.liste({recherche:'moi',statut:'nouveau',page:'1'});
 assert.equal(value.compteurs.tous,5);
 assert.equal(value.pagination.total,2);
 assert.equal(value.messages[0].id,4);
 assert.equal(queries[1].args[0],'nouveau');
 assert.match(queries[1].sql,/LIMIT \? OFFSET \?/);
 assert.doesNotMatch(queries[1].sql,/moi/);
});
test('Support : confirmation administrative, mais aucun changement de statut de compte',async()=>{
 const events=[];
 const model={detail:async()=>({message:{compte_id:4,compte_role:'client'}}),statut:async(...args)=>{events.push(args);return true;}};
 const ctrl=charge('server/controllers/adminSupportController.js',{'../models/adminSupportModel':model,'../services/adminMailService':{}});
 let res=response();await ctrl.modifier({body:{statut:'traite'},params:{id:'12'},session:{utilisateur:{id:7}}},res);
 assert.equal(res.code,200);assert.equal(events.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(events[0])),['12','traite',7]);
 res=response();await ctrl.modifier({body:{statut:'bloque'},params:{id:'12'},session:{utilisateur:{id:7}}},res);
 assert.equal(res.code,400);
 assert.doesNotMatch(read('server/controllers/adminSupportController.js'),/UPDATE users|email_verified\s*=/);
});
test('Support : aucun e-mail autorise pour un visiteur sans compte',async()=>{
 const ctrl=charge('server/controllers/adminSupportController.js',{'../models/adminSupportModel':{
   idValide:n=>Number(n),detail:async()=>({message:{compte_id:null}})
 },'../services/adminMailService':{envoyerCourrielAdmin:async()=>{throw Error('ne doit pas etre appele')}}});
 const res=response();await ctrl.repondre({params:{id:'4'},body:{sujet:'Reponse',corps:'Bonjour',cle:'176760e2-052f-44b2-9fb6-8854b25e4dc5'},session:{utilisateur:{id:1}}},res);
 assert.equal(res.code,403);
});
test('Support : e-mail seulement confirme apres succes SMTP, cle anti-doublon',async()=>{
 const calls=[];
 const model={idValide:n=>Number(n),detail:async()=>({message:{compte_id:2,compte_role:'artisan',compte_email:'test@example.com'}}),
  preparerReponse:async x=>{calls.push(['reserve',x]);return {envoi:true,id:10};},resultatEnvoi:async(id,ok)=>{calls.push(['result',id,ok]);}};
 const ctrl=charge('server/controllers/adminSupportController.js',{'../models/adminSupportModel':model,'../services/adminMailService':{envoyerCourrielAdmin:async()=>{calls.push(['smtp']);}}});
 const prev=process.env.MAIL_FROM;process.env.MAIL_FROM='support@example.com';
 try {const res=response();await ctrl.repondre({params:{id:'4'},body:{sujet:'Reponse',corps:'Bonjour',cle:'176760e2-052f-44b2-9fb6-8854b25e4dc5'},session:{utilisateur:{id:1}}},res);
 assert.equal(res.code,200);assert.equal(calls[0][0],'reserve');assert.equal(calls[1][0],'smtp');assert.deepEqual(calls[2],['result',10,true]);}
 finally {if(prev===undefined)delete process.env.MAIL_FROM;else process.env.MAIL_FROM=prev;}
 assert.match(read('scripts/migrate-support-admin.js'),/UNIQUE KEY uq_support_dedup/);
});
test('Support : interface connectee, pas de donnees fictives ni simulation email',()=>{
 const js=read('client/public/js/admin-support-page.js');
 assert.match(js,/\/api\/admin\/support\/messages/);
 assert.match(js,/correspondance_email/);
 assert.match(js,/support-reply-form/);
 assert.match(js,/Visiteur sans compte Taskly/);
 assert.match(js,/new Blob/);
 assert.doesNotMatch(js,/Donn[eé]es (fictives|de d[eé]monstration)|simulation de l.envoi/);
});
test('Support : la meme cle idempotente ne redemarre jamais un envoi',async()=>{
 const model={idValide:n=>Number(n),detail:async()=>({message:{compte_id:2,compte_role:'client',compte_email:'client@example.com'}}),
  preparerReponse:async()=>({envoi:false,statut:'sent'})};
 let sent=false;
 const ctrl=charge('server/controllers/adminSupportController.js',{'../models/adminSupportModel':model,'../services/adminMailService':{envoyerCourrielAdmin:async()=>{sent=true;}}});
 const previous=process.env.MAIL_FROM;process.env.MAIL_FROM='support@example.com';
 try {const res=response();await ctrl.repondre({params:{id:'4'},body:{sujet:'Reponse',corps:'Bonjour',cle:'176760e2-052f-44b2-9fb6-8854b25e4dc5'},session:{utilisateur:{id:1}}},res);
 assert.equal(res.code,409);assert.equal(sent,false);}
 finally{if(previous===undefined)delete process.env.MAIL_FROM;else process.env.MAIL_FROM=previous;}
});
test('Support : un refus SMTP est enregistre en echec et non en succes',async()=>{
 const calls=[];
 const model={idValide:n=>Number(n),detail:async()=>({message:{compte_id:2,compte_role:'client',compte_email:'client@example.com'}}),
  preparerReponse:async()=>({envoi:true,id:6}),resultatEnvoi:async(id,ok)=>{calls.push([id,ok]);}};
 const ctrl=charge('server/controllers/adminSupportController.js',{'../models/adminSupportModel':model,'../services/adminMailService':{envoyerCourrielAdmin:async()=>{throw Error('SMTP indisponible');}}});
 const previous=process.env.MAIL_FROM;process.env.MAIL_FROM='support@example.com';
 const orig=console.error;console.error=()=>{};
 try {const res=response();await ctrl.repondre({params:{id:'4'},body:{sujet:'Reponse',corps:'Bonjour',cle:'176760e2-052f-44b2-9fb6-8854b25e4dc5'},session:{utilisateur:{id:1}}},res);
 assert.equal(res.code,502);assert.deepEqual(calls,[[6,false]]);}
 finally{console.error=orig;if(previous===undefined)delete process.env.MAIL_FROM;else process.env.MAIL_FROM=previous;}
});
test('Support : un visiteur anonyme ne peut pas etre mis en cours via API',async()=>{
 let called=false;
 const ctrl=charge('server/controllers/adminSupportController.js',{'../models/adminSupportModel':{
   detail:async()=>({message:{compte_id:null}}),statut:async()=>{called=true;return true;}
 },'../services/adminMailService':{}});
 const res=response();await ctrl.modifier({body:{statut:'en_cours'},params:{id:'5'},session:{utilisateur:{id:1}}},res);
 assert.equal(res.code,403);assert.equal(called,false);
});
