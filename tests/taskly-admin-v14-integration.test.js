'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {createServiceThreads}=require('../server/services/tasklyMailServiceThreads');
function harness(){
 const queries=[];
 const transaction=fn=>fn({query:async(sql,params)=>{
   queries.push({sql,params});
   if(/INSERT INTO taskly_mail_service_threads/.test(sql))return [{insertId:45}];
   if(/INSERT INTO taskly_mail_service_entries/.test(sql))return [{insertId:46}];
   if(/SELECT id,user_address FROM taskly_mail_service_threads/.test(sql))return [[{id:45,user_address:'some@example.com'}]];
   if(/SELECT id FROM taskly_mail_service_threads/.test(sql))return [[{id:45}]];
   return [[]];
 }});
 const api=createServiceThreads({transaction,userMailbox:async()=>null,
   contactAccount:async(_,id)=>({user_id:id,address:'some@example.com'}),
   authorizeAdmin:async context=>context.verified===true&&context.serverAdmin===true});
 return {queries,api};
}
test('V14: admin starts support thread with existing account, no mailbox required',async()=>{
 const h=harness();const res=await h.api.createFromAdmin({userId:8,verified:true,serverAdmin:true},23,'Objet','Texte');
 assert.equal(res.threadId,45);assert.equal(h.queries.length,2);
 assert.deepEqual(h.queries[0].params,[23,'some@example.com','Objet']);
});
test('V14: reject unverified admin before database access',async()=>{
 const h=harness();await assert.rejects(h.api.createFromAdmin({userId:8,verified:false,serverAdmin:true},23,'Objet','Texte'),e=>e.status===403);
 assert.equal(h.queries.length,0);
});
test('V14: user replies in own Support thread without a professional mailbox',async()=>{
 const h=harness();const out=await h.api.replyAsUser(23,45,'Réponse');assert.equal(out.threadId,45);
 assert.match(h.queries[0].sql,/user_id=\? AND service_name='support'/);
 assert.deepEqual(h.queries[0].params,[45,23]);
});
test('V14: directory is admin-only and restricts to active client/artisan accounts',()=>{
 const route=read('server/routes/tasklyMailServiceV3Routes.js');
 assert.match(route,/admin\.get\('\/support\/contacts'/);
 assert.match(route,/adminContext\(req\)\.verified/);
 assert.match(route,/role IN \('client','artisan'\)/);
 assert.match(route,/statut_compte='actif'/);
 assert.match(route,/LIMIT 51 OFFSET \?/);
});
test('V14: support FK migration points to users, never deletes old threads',()=>{
 const sql=read('database/migration_taskly_admin_support_contacts_v14.sql');
 assert.match(sql,/REFERENCES users\(id\) ON DELETE RESTRICT/);
 assert.doesNotMatch(sql,/DELETE FROM|TRUNCATE|DROP TABLE/i);
});
test('V14: admin can select accounts by name instead of typing a user ID',()=>{
 const ui=read('client/public/js/taskly-mail-v3-admin-design.js');
 assert.match(ui,/support\/contacts\?q=/);
 assert.match(ui,/const uid=el\('select'/);
 assert.doesNotMatch(ui,/uid\.pattern='\[1-9\]/);
});
test('V14: administrative mailbox UI remains validated and errors can retry',()=>{
 const js=read('client/public/js/taskly-admin-mail-v10.js');
 const html=read('client/private/admin/taskly-mail.html');
 assert.match(js,/Réessayer/);
 assert.match(html,/taskly-admin-mail-v10\.js\?v=14/);
 assert.match(html,/tmv6-admin-mail/);
});
test('V14: automatic provisioning and client-artisan chat/LiveKit remain untouched by support',()=>{
 const support=read('server/services/tasklyMailServiceThreads.js');
 const route=read('server/routes/tasklyMailServiceV3Routes.js');
 assert.doesNotMatch(support,/taskly_chat_messages|livekit|taskly_chat_keys/);
 assert.doesNotMatch(route,/taskly_chat_messages|livekit|taskly_chat_keys/);
 assert.match(read('server/routes/professionalMailRoutes.js'),/if\(autoInternal&&decision==='confirm'\)/);
 assert.match(read('server/routes/professionalMailRoutes.js'),/TASKLY_ADMIN_MANUAL_MAIL_ENABLED/);
});
