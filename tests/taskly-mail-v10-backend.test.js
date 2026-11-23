'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createInternalGateway}=require('../server/services/professionalMailInternal');
const key='bca4a444-1234-4321-8123-111111111111';
function harness(destination,existingThreadId=null){
 const sql=[];
 const sender={user_id:12,address:'alice@client.taskly.dz',provider_id:'internal:'+'a'.repeat(64),
  artisan_id:null,service_id:null,personal_email:'alice@gmail.com',proposed_address:'alice@client.taskly.dz',status:'approved_pending_provider',confirmed_at:'ok',activated_at:'ok'};
 const conn={query:async(query,params)=>{sql.push([query,params]);if(query.includes('FROM taskly_professional_mailboxes m'))return [[sender]];if(query.includes('SELECT message_id,to_address,subject,body'))return [[]];if(query.includes('SELECT id FROM taskly_mail_service_threads'))return [existingThreadId==null?[]:[{id:existingThreadId}]];if(query.includes('INSERT INTO taskly_mail_service_threads'))return [{insertId:77}];return [{affectedRows:1}];}};
 const env={TASKLY_MAIL_INTERNAL_ENABLED:'true',TASKLY_MAIL_GATEWAY_ENABLED:'false',TASKLY_MAIL_FOLDERS_ENABLED:'true',TASKLY_MAIL_UNIFIED_SUPPORT_ENABLED:'true',TASKLY_ADMIN_MAIL_V10_ENABLED:'true'};
 const service=createInternalGateway({transaction:fn=>fn(conn),profil:async()=>({id:12}),correspond:()=>true,env});
 return {sql,sender,send:()=>service.send({user_id:sender.user_id,address:sender.address,provider_id:sender.provider_id},{to:destination,subject:'Question',body:'Bonjour',key})};
}
test('V10: l’envoi vers admin crée seulement une copie admin et la copie envoyée',async()=>{
 const h=harness('administration@taskly.dz');const result=await h.send();assert.match(result.id,/^[a-f0-9-]{36}$/);assert.equal(h.sql.filter(([q])=>q.includes('INSERT INTO taskly_admin_mail_messages')).length,1);assert.equal(h.sql.filter(([q])=>q.includes('INSERT INTO taskly_professional_mail_messages')).length,1);assert.ok(!h.sql.some(([q])=>q.includes('SELECT user_id FROM taskly_professional_mailboxes')));
});
test('V10: envoi Support crée le fil réel et la copie privée envoyée',async()=>{
 const h=harness('support@taskly.dz');await h.send();assert.equal(h.sql.filter(([q])=>q.includes('INSERT INTO taskly_mail_service_threads')).length,1);assert.equal(h.sql.filter(([q])=>q.includes('INSERT INTO taskly_mail_service_entries')).length,1);assert.equal(h.sql.filter(([q])=>q.includes('INSERT INTO taskly_professional_mail_messages')).length,1);
});
test('V10: destination publique refusée sans envoi',async()=>{
 const h=harness('bad@gmail.com');await assert.rejects(h.send(),{status:400});assert.equal(h.sql.length,0);
});

test('V10.1: un nouveau message Support réutilise un fil déjà existant',async()=>{
 const h=harness('support@taskly.dz',91);await h.send();
 assert.equal(h.sql.filter(([q])=>q.includes('INSERT INTO taskly_mail_service_threads')).length,0);
 const entry=h.sql.find(([q])=>q.includes('INSERT INTO taskly_mail_service_entries'));
 assert.equal(entry[1][0],91);
 assert.ok(h.sql.some(([q])=>q.includes('UPDATE taskly_mail_service_threads SET updated_at')));
});
