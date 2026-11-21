'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const prefs=require('../server/services/professionalMailPreferences');
const {createInternalGateway}=require('../server/services/professionalMailInternal');
const {createNotifications}=require('../server/services/professionalMailNotifications');
const env={TASKLY_MAIL_PILOT_ENABLED:'true',TASKLY_MAIL_INTERNAL_ENABLED:'true',TASKLY_MAIL_READ_LINK_ENABLED:'true',TASKLY_MAIL_GATEWAY_ENABLED:'false',TASKLY_MAIL_FOLDERS_ENABLED:'true',PUBLIC_SITE_URL:'https://taskly.example.test'};
const address='artisan@plomberie.taskly.test',provider_id='internal:'+'a'.repeat(64);

test('Préférences : validation complète, jamais de champs arbitraires',()=>{
 assert.deepEqual(prefs.validate({...prefs.defaults}),{...prefs.defaults});
 for(const input of [{...prefs.defaults,admin:true},{...prefs.defaults,notify_email:'yes'},{...prefs.defaults,signature:'a'.repeat(1201)},{...prefs.defaults,auto_save:1},{}]){
  assert.throws(()=>prefs.validate(input),{status:400});
 }
});
test('Préférences : enregistrement paramétré, isolé par boîte',async()=>{
 const queries=[];const db={query:async(sql,p)=>{queries.push([sql,p]);return sql.startsWith('SELECT')?[[{notify_email:0,signature_enabled:1,signature:'Cordialement',confirm_delete:1,preview_enabled:0,auto_save:1}]]:[{affectedRows:1}];}};
 const p=await prefs.load(db,42);assert.equal(p.notify_email,false);assert.equal(p.signature,'Cordialement');
 await prefs.save(db,42,{...prefs.defaults,notify_email:false,signature:'À bientôt'});
 assert.ok(queries.every(([q,params])=>!q.includes('42')&&params[0]===42));
 assert.match(queries.at(-1)[0],/WHERE user_id|INSERT INTO taskly_mail_preferences/);
 assert.ok(!queries.at(-1)[0].includes('À bientôt'));
});
test('Corbeille : suppression définitive uniquement pour la copie de son propriétaire, déjà supprimée',async()=>{
 let trashed=false,deleted=0;const queries=[];const conn={query:async(q,p)=>{queries.push([q,p]);if(q.includes('SELECT m.*'))return [[{user_id:5,address,proposed_address:address,provider_id}]];if(q.startsWith('SELECT trashed_at'))return [[{trashed_at:trashed?'2026-11-20':null}]];if(q.startsWith('DELETE FROM')){deleted++;return [{affectedRows:1}];}return [{affectedRows:1}];}};
 const gateway=createInternalGateway({transaction:f=>f(conn),profil:async()=>({id:5}),correspond:()=>true,env});
 const owner={user_id:5,address,provider_id};
 await assert.rejects(gateway.changeCopy(owner,'12','delete'),{status:409});assert.equal(deleted,0);
 trashed=true;assert.deepEqual(await gateway.changeCopy(owner,'12','delete'),{ok:true});assert.equal(deleted,1);
 const deletion=queries.find(([q])=>q.startsWith('DELETE FROM'));
 assert.match(deletion[0],/owner_user_id=\?/);assert.match(deletion[0],/trashed_at IS NOT NULL/);assert.deepEqual(deletion[1],[5,'12']);
 await assert.rejects(gateway.changeCopy(owner,'12','deleteAll'),{status:400});
});
test('Notifications : préférence désactivée => aucun e-mail, aucun lien créé',async()=>{
 const events=[];const transaction=fn=>fn({query:async(sql,params)=>{events.push([sql,params]);
  if(sql.startsWith('SELECT status,attempts'))return [[{status:'pending',attempts:0,retry_due:1}]];
  if(sql.startsWith('SELECT notify_email'))return [[{notify_email:0}]];
  if(sql.includes("SET status='cancelled'"))return [{affectedRows:1}];
  throw Error('SQL inattendu '+sql);
 }});
 const svc=createNotifications({transaction,env,active:async()=>({user_id:5,address,notificationEmail:'real@example.test'}),format:x=>x,send:async()=>{throw Error('Ne doit pas envoyer');}});
 assert.equal(await svc.deliver(5,'mess1'),false);
 assert.ok(events.some(([q])=>q.includes("SET status='cancelled'")));
 assert.ok(!events.some(([q])=>q.includes("SET status='sending'")));
});
test('Front-end V2 : données API, 7 dossiers, paramètres réels, contenu texte sécurisé',()=>{
 const js=fs.readFileSync('client/public/js/professional-mail-folders.js','utf8');
 assert.match(js,/\/preferences/);assert.match(js,/request\('\/preferences','PUT',next\)/);assert.match(js,/\.textContent=/);assert.doesNotMatch(js,/\.innerHTML/);
 for(const folder of ['inbox','sent','draft','favorites','archive','trash','settings'])assert.ok(js.includes(folder));
 assert.match(js,/const defaults=.*notify_email:true/);
 const css=fs.readFileSync('client/public/css/professional-mailbox.css','utf8');assert.match(css,/TASKLY MAIL PREMIUM V2/);assert.match(css,/--tm-green:#008267/);
});
