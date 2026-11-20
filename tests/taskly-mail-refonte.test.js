'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../server/services/professionalMailPolicy'),mailboxRoutes=require('../server/routes/professionalMailboxRoutes'),{createInternalGateway,internalAddress}=require('../server/services/professionalMailInternal');
const secret='x'.repeat(48),address='test.artisan@plomberie.taskly.test';
function harness({attempts=0,box=false,fail=false,allowed=true,client=false,general=client,clientEnabled=client,wrongClient=false,inactive=false,unverified=false}={}){const address=client?'test.client@client.taskly.test':'test.artisan@plomberie.taskly.test';const routes=new Map(),events=[],profile={id:1,role:'artisan',statut_compte:'actif',email_verified:1,verification_statut:'approuve',artisan_id:10,service_id:2,email:'test@example.test'};if(client)Object.assign(profile,{
 role:'client',client_id:20,
 artisan_id:null,service_id:null
});
if(inactive)profile.statut_compte='suspendu';
if(unverified)profile.email_verified=0;
const row={user_id:1,artisan_id:10,service_id:2,personal_email:profile.email,proposed_address:address,status:'pending_confirmation',attempts,code_hash:policy.empreinte(secret,1,address,'123456')};if(client)Object.assign(row,{
 client_id:wrongClient?21:20,
 artisan_id:null,service_id:null
});
const router={use(){},get(){},post(u,...hs){routes.set(u,hs.at(-1));}};const conn={beginTransaction:async()=>events.push('begin'),commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release(){},query:async(sql,params)=>{events.push(sql);if(sql.includes('JOIN clients c'))return [client?[profile]:[]];if(sql.includes('FROM users u'))return [client?[]:[profile]];if(sql.startsWith('SELECT * FROM taskly_professional_mail_requests'))return [[row]];if(sql.startsWith('SELECT user_id FROM taskly_professional_mailboxes'))return [box?[{user_id:1}]:[]];if(sql.startsWith('INSERT INTO taskly_professional_mailboxes')&&fail)throw Error('Simulated SQL failure');return [{affectedRows:1}];}};const mocks={'express':{Router:()=>router},'../config/db':{promise:()=>({getConnection:async()=>conn})},'../middleware/authMiddleware':{verifierConnexion(){},verifierArtisan(){},verifierAdmin(){}},'../middleware/securityMiddleware':{limiter:()=>()=>{}},'../services/professionalMailPolicy':policy,'../services/professionalMailInternal':{internalAddress,createInternalGateway:()=>({configured:true,provision:async(a,k)=>{assert.equal(a,address);return 'internal:'+k;}})},'../services/professionalMailGateway':{createGateway:()=>({configured:false})},'./professionalMailboxRoutes':{mount(){},provisionKey:mailboxRoutes.provisionKey}};const module={exports:{}};vm.runInNewContext(fs.readFileSync('server/routes/professionalMailRoutes.js','utf8'),{module,require:n=>mocks[n]||require(n === '../services/professionalMailAccess' ? '../server/services/professionalMailAccess' : n),console:{error(){}},process:{env:{TASKLY_MAIL_INTERNAL_ENABLED:'true',TASKLY_MAIL_AUTO_ACTIVATION:'true',TASKLY_MAIL_PILOT_USER_IDS:allowed?'1':'2',SESSION_SECRET:secret,
TASKLY_MAIL_PILOT_ENABLED:'true',
TASKLY_MAIL_GATEWAY_ENABLED:'false',
TASKLY_MAIL_GENERAL_ENABLED:String(general),
TASKLY_MAIL_CLIENT_ENABLED:String(clientEnabled)}}});return {events,async confirm(code='123456',decision='confirm'){const r={code:200,status(n){this.code=n;return this;},json(v){this.value=v;}};await routes.get('/confirm')({body:{code,decision},session:{utilisateur:{id:1}}},r);return r;}};}
test('Confirmation exacte : une transaction crée et active la boîte sans administrateur',async()=>{const h=harness(),r=await h.confirm();assert.equal(r.code,200);assert.equal(r.value.activated,true);assert.ok(h.events.some(x=>x.startsWith("UPDATE taskly_professional_mail_requests SET status='approved_pending_provider'")));assert.ok(h.events.some(x=>x.includes('INSERT INTO taskly_professional_mailboxes (user_id,address,provider_id,activated_at)')));assert.equal(h.events.at(-1),'commit');});
test('Code erroné, épuisé, annulation, boîte existante et utilisateur non autorisé : aucune création',async()=>{for(const [opts,code,decision] of [[{},'000000','confirm'],[{attempts:3},'123456','confirm'],[{},'123456','cancel'],[{box:true},'123456','confirm'],[{allowed:false},'123456','confirm']]){const h=harness(opts);const r=await h.confirm(code,decision);assert.notEqual(r.value?.activated,true);assert.ok(!h.events.some(x=>x.startsWith('INSERT INTO taskly_professional_mailboxes')));}});
test('Échec SQL : rollback et aucune annonce de réussite',async()=>{let h=harness({fail:true}),r=await h.confirm();assert.equal(r.code,503);assert.equal(h.events.at(-1),'rollback');assert.ok(!h.events.includes('commit'));});
function folders(){const calls=[],owner={user_id:1,address,provider_id:'internal:'+'a'.repeat(64),proposed_address:address};const conn={query:async(sql,p)=>{calls.push([sql,p]);if(sql.includes('SELECT m.*'))return [[owner]];if(sql.startsWith('SELECT trashed_at'))return [[{trashed_at:null}]];if(sql.startsWith('SELECT *,CAST'))return [[{sequence_id:'10',folder:'inbox',message_id:'uuid',from_address:address,to_address:address,subject:'test',body:'ok',created_at:new Date(),is_read:0}]];if(sql.includes('COUNT(*)'))return [[{total:2}]];return [sql.startsWith('SELECT')?[]:{affectedRows:1}];}};const gateway=createInternalGateway({env:{TASKLY_MAIL_INTERNAL_ENABLED:'true',TASKLY_MAIL_GATEWAY_ENABLED:'false',TASKLY_MAIL_FOLDERS_ENABLED:'true'},transaction:f=>f(conn),profil:async(c,id)=>({id}),correspond:(p,m)=>p.id===m.user_id});return {gateway,owner,calls};}
test('Dossiers et recherche : toutes les requêtes sont limitées à la copie du propriétaire',async()=>{const {gateway,owner,calls}=folders();for(const f of ['inbox','sent','favorites','archive','trash'])await gateway.listCopies(owner,f,null,'recherche');await gateway.readCopy(owner,'10');for(const a of ['star','archive','trash','restore'])await gateway.changeCopy(owner,'10',a);assert.equal((await gateway.counts(owner)).unread,2);for(const [q,p] of calls.filter(([q])=>q.includes('taskly_professional_mail_messages'))){assert.match(q,/owner_user_id\s*=\s*\?/);assert.equal(p[0],1);}await assert.rejects(gateway.changeCopy(owner,'10','deleteAll'),{status:400});await assert.rejects(gateway.readCopy(owner,'0'),{status:400});await assert.rejects(gateway.readCopy({...owner,provider_id:'internal:'+'b'.repeat(64)},'10'),{status:403});});

test('Client : activation automatique reussie',async()=>{
 const h=harness({client:true});
 const r=await h.confirm();
 assert.equal(r.code,200);
 assert.equal(r.value.activated,true);
});

test('Client : autre profil refuse',async()=>{
 const h=harness({client:true,wrongClient:true});
 const r=await h.confirm();
 assert.notEqual(r.value?.activated,true);
 assert.ok(!h.events.some(x=>x.startsWith(
  'INSERT INTO taskly_professional_mailboxes'
 )));
});

test('Client : compte inactif refuse',async()=>{
 const h=harness({client:true,inactive:true});
 assert.equal((await h.confirm()).code,403);
});

test('Client : email non verifie refuse',async()=>{
 const h=harness({client:true,unverified:true});
 assert.equal((await h.confirm()).code,403);
});

test('Client : fonctionnalite desactivee',async()=>{
 const h=harness({client:true,clientEnabled:false});
 assert.equal((await h.confirm()).code,403);
});

test('Artisan : mode general hors liste pilote',async()=>{
 const h=harness({general:true,allowed:false});
 assert.equal((await h.confirm()).value.activated,true);
});