'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {createServiceThreads}=require('../server/services/tasklyMailServiceThreads');
function harness({admin=true,mailbox=true}={}) {
 const calls=[],tx=async fn=>fn({query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql.includes('INSERT INTO taskly_mail_service_threads'))return [{insertId:31}];
  if(sql.includes('INSERT INTO taskly_mail_service_entries'))return [{insertId:32}];
  if(sql.includes('SELECT id,user_address FROM taskly_mail_service_threads'))return [[{id:31,user_address:'a@client.taskly.dz'}]];
  return [[]];
 }});
 const service=createServiceThreads({transaction:tx,
  userMailbox:async(_,uid)=>mailbox?{user_id:uid,address:'a@client.taskly.dz'}:null,
  authorizeAdmin:async()=>admin});
 return {service,calls};
}
test('V13: admin can open Support thread only for verified mailbox and server role',async()=>{
 const h=harness();const data=await h.service.createFromAdmin({userId:1,verified:true},123,'Question','Bonjour');
 assert.equal(data.threadId,31);assert.equal(h.calls.length,2);
 assert.match(h.calls[0].sql,/service_name,user_id,user_address,subject/);
 assert.deepEqual(h.calls[0].args,[123,'a@client.taskly.dz','Question']);
 assert.match(h.calls[1].sql,/sender_admin_id/);
});
test('V13: reject unauthorized administrator before SQL',async()=>{
 const h=harness({admin:false});await assert.rejects(h.service.createFromAdmin({userId:1},123,'Hello','Bonjour'),e=>e.status===403);
 assert.equal(h.calls.length,0);
});
test('V13: reject non-verified recipient before inserting thread',async()=>{
 const h=harness({mailbox:false});await assert.rejects(h.service.createFromAdmin({userId:1},123,'Hello','Bonjour'),e=>e.status===403);
 assert.equal(h.calls.length,0);
});
test('V13: user may reply only to own Support thread and verified mailbox',async()=>{
 const h=harness();const data=await h.service.replyAsUser(123,31,'Je confirme');
 assert.equal(data.threadId,31);assert.equal(h.calls.length,3);
 assert.match(h.calls[0].sql,/WHERE id=\? AND user_id=\? AND service_name='support'/);
 assert.deepEqual(h.calls[0].args,[31,123]);
 const other=harness({mailbox:false});await assert.rejects(other.service.replyAsUser(123,31,'Bonjour'),e=>e.status===403);
});
test('V13: manual box provisioning checks OTP-backed approved request and admin context',()=>{
 const route=read('server/routes/professionalMailRoutes.js');
 assert.match(route,/TASKLY_ADMIN_MANUAL_MAIL_ENABLED/);
 assert.match(route,/req\.session\?\.adminVerified!==true\|\|req\.tasklyAdminContext!==true/);
 assert.match(route,/r\.status!=='approved_pending_provider'\|\|!r\.confirmed_at\|\|!correspond\(p,r\)/);
 assert.match(route,/gateway\.provision\(r\.proposed_address,key\)/);
 assert.match(route,/SELECT user_id FROM taskly_professional_mailboxes WHERE user_id=\? OR address=\? FOR UPDATE/);
});
test('V13: private chats and LiveKit are not rewritten or imported by new support service',()=>{
 const service=read('server/services/tasklyMailServiceThreads.js');
 const route=read('server/routes/tasklyMailServiceV3Routes.js');
 assert.doesNotMatch(service,/taskly_chat_messages|chatCall|livekit|taskly_chat_keys/);
 assert.doesNotMatch(route,/taskly_chat_messages|chatCall|livekit/);
 assert.match(route,/createFromAdmin\(adminContext\(req\)/);
 assert.match(route,/replyAsUser\(req\.session\.utilisateur\.id/);
});
