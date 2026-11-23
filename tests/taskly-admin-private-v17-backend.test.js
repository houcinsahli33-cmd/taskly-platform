'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const {createService,envelope}=require('../server/services/tasklyAdminPrivateV17Service');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('V17P2: only isolated files/routes; no legacy chat routing changes',()=>{
 const app=read('server/app.js');
 assert.match(app,/TASKLY_ADMIN_PRIVATE_V17_ENABLED === 'true'/);
 assert.match(app,/api\/admin\/taskly-private-v17/);
 assert.match(app,/api\/taskly-private-v17/);
 const routes=read('server/routes/tasklyAdminPrivateV17Routes.js');
 assert.match(routes,/verifierAdmin/);assert.match(routes,/tasklyAdminContext===true/);
 assert.doesNotMatch(routes,/chatModel|chatController|tasklyMailServiceThreads/);
});
test('V17P2: requires ciphertext envelope, never stores plaintext body',()=>{
 assert.throws(()=>envelope({body:'hello'}),/Enveloppe/);
 assert.throws(()=>envelope({alg:'AES-256-GCM',keyVersion:1,nonce:'invalid',ciphertext:'abc'}),/Enveloppe/);
 assert.equal(envelope({alg:'AES-256-GCM',keyVersion:1,nonce:'AAAAAAAAAAAAAAAA',ciphertext:'AAAAAAAAAAAAAAAAAAAAAAAA'}).alg,'AES-256-GCM');
 const sql=read('database/migration_taskly_admin_private_v17.sql');
 assert.doesNotMatch(sql,/(?:ALTER|DROP) TABLE/i);
 assert.match(sql,/taskly_admin_private_messages/);
 assert.doesNotMatch(sql,/taskly_chat_messages/);
});
test('V17P2: prevents admin reading unrelated member and conversely',async()=>{
 const calls=[];
 const db={query:async(sql,params)=>{
    calls.push([sql,params]);
    if(sql.includes('FROM taskly_admin_private_threads WHERE id='))return [[{id:1,admin_user_id:11,member_user_id:22}]];
    if(sql.includes('FROM users WHERE id='))return [[{id:params[0],role:params[0]===11?'admin':'client'}]];
    if(sql.includes('FROM taskly_admin_private_messages'))return [[]];
    return [[]];
   },getConnection:async()=>({query:(...args)=>db.query(...args),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}})};
 const svc=createService({db});
 await assert.rejects(svc.read(33,'user',1),e=>e.status===404);
 await assert.rejects(svc.read(22,'admin',1),e=>e.status===404);
 assert.deepEqual(await svc.read(22,'user',1),[]);
 assert.deepEqual(await svc.read(11,'admin',1),[]);
});
