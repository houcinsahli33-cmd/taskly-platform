'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const policy=require('../server/services/professionalMailPolicy');
const {createGateway,email}=require('../server/services/professionalMailGateway');
const secret='s'.repeat(48);
test('Mail: cancellation allows a new request only for unchanged profile after cooldown',()=>{
 assert.equal(policy.peutDemander(null,false),true);
 for(const status of ['cancelled','pending_confirmation']){
  assert.equal(policy.peutDemander({status,age:60},true),true);
  assert.throws(()=>policy.peutDemander({status,age:59},true),{status:429});
  assert.throws(()=>policy.peutDemander({status,age:null},true),{status:429});
  assert.throws(()=>policy.peutDemander({status,age:120},false),{status:409});
 }
 for(const status of ['rejected','pending_admin','approved_pending_provider'])assert.throws(()=>policy.peutDemander({status,age:120},true),{status:409});
});
test('Mail: code requires strong secret and binds numeric SQL ID consistently',()=>{
 const a='artisan@plomberie.example.test';
 assert.throws(()=>policy.empreinte('short',1,a,'123456'),{status:503});
 assert.equal(policy.empreinte(secret,'1',a,'123456'),policy.empreinte(secret,1,a,'123456'));
 assert.equal(policy.codeValide(secret,{user_id:1,proposed_address:a,code_hash:policy.empreinte(secret,1,a,'123456')},'123456'),true);
});
test('Mail: rejects malformed domains and local parts while accepting ordinary addresses',()=>{
 for(const a of ['.a@example.test','a.@example.test','a..b@example.test','a@-example.test','a@example-.test','a@example..test','a@'+('a'.repeat(64))+'.test','a'.repeat(65)+'@example.test','a@foo.test\n','a@example.test,b@example.test'])assert.equal(email(a),false,a);
 for(const a of ['a.b+test@example.test','a@sub.example.test','a@EXAMPLE.TEST'])assert.equal(email(a),true,a);
});
test('Mail: gateway rejects repeated cursor, duplicated message or malformed provider cursor as 503',async()=>{
 const mailbox={provider_id:'box-a',address:'a@example.test'},owner={mailboxId:mailbox.provider_id,address:mailbox.address};
 const m={id:'m1',from:'b@example.test',to:mailbox.address,subject:'Test',date:'2026-11-19T00:00:00Z'};
 const env={TASKLY_MAIL_GATEWAY_ENABLED:'true',TASKLY_MAIL_GATEWAY_URL:'https://gateway.example.test/',TASKLY_MAIL_GATEWAY_SECRET:secret};
 const gateway=data=>createGateway({env,fetcher:async()=>new Response(JSON.stringify({...owner,...data}),{headers:{'Content-Type':'application/json'}})});
 for(const data of [{messages:[m,m],next:null},{messages:[m],next:'bad cursor'},{messages:[m],next:'same'}])await assert.rejects(gateway(data).list(mailbox,'inbox','same'),{status:503});
 const result=await gateway({messages:[m],next:'different'}).list(mailbox,'inbox','same');assert.equal(result.next,'different');assert.equal(result.messages.length,1);
});
function harness(status='cancelled',age=120){
 const routes=new Map(),queries=[],sent=[],p={id:1,nom:'Test',prenom:'Artisan',email:'personal@example.test',role:'artisan',statut_compte:'actif',email_verified:1,artisan_id:10,service_id:2,verification_statut:'approuve',service_nom:'Plomberie'};
 const previous={user_id:1,artisan_id:10,service_id:2,personal_email:p.email,proposed_address:'test.artisan@plomberie.example.test',status,age};
 const router={use(){},get(){},post(url,...handlers){routes.set(url,handlers.at(-1));}};
 const conn={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql,args)=>{queries.push([sql,args]);if(sql.includes('FROM users u'))return [[p]];if(sql.includes('TIMESTAMPDIFF'))return [[previous]];return [{affectedRows:1}];}};
 const mocks={'express':{Router:()=>router},'../config/db':{promise:()=>({getConnection:async()=>conn})},'../middleware/authMiddleware':{verifierConnexion(){},verifierArtisan(){},verifierAdmin(){}},'../middleware/securityMiddleware':{limiter:()=>()=>{}},'../services/professionalMailPolicy':policy,'../services/professionalMailGateway':{createGateway:()=>({configured:false})},'../services/emailService':{estConfigure:()=>true},'../services/adminMailService':{envoyerCourrielAdmin:async(...args)=>sent.push(args)},'./professionalMailboxRoutes':{mount(){}}};
 const file=path.join(__dirname,'../server/routes/professionalMailRoutes.js');const module={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,require:n=>mocks[n]||require(n),console:{error(){}},process:{env:{TASKLY_MAIL_DOMAIN:'example.test',SESSION_SECRET:secret}}});
 const res={code:200,status(n){this.code=n;return this;},json(v){this.value=v;return this;}};
 return {queries,sent,previous,res,async request(){await routes.get('/request')({session:{utilisateur:{id:1}}},res);}};
}
test('Mail route: cancelled request resets confirmation only, preserves address and sends fresh code',async()=>{
 const h=harness();await h.request();assert.equal(h.res.code,201);assert.equal(h.sent.length,1);const code=h.sent[0][2].match(/Code : (\d{6})/)[1];
 const update=h.queries.find(([sql])=>sql.startsWith('UPDATE'));assert.match(update[0],/status='pending_confirmation'/);assert.match(update[0],/confirmed_at=NULL/);assert.equal(update[1][0],policy.empreinte(secret,1,h.previous.proposed_address,code));assert.equal(update[1][1],1);assert.ok(h.sent[0][2].includes(h.previous.proposed_address));
});
test('Mail route: rejected or newly cancelled request does not send e-mail or modify SQL',async()=>{
 for(const [status,age,expected] of [['rejected',120,409],['cancelled',30,429],['approved_pending_provider',120,409]]){const h=harness(status,age);await h.request();assert.equal(h.res.code,expected);assert.equal(h.sent.length,0);assert.ok(!h.queries.some(([sql])=>sql.startsWith('UPDATE')));}
});
const timing=require('../server/helpers/performanceTiming');
test('Performance timing: opt-in only, preserves middleware success and errors',()=>{
 const previous=process.env.TASKLY_PERF_TIMING;try{
  const headers=[],res={append:(name,value)=>headers.push([name,value])};let calls=0;delete process.env.TASKLY_PERF_TIMING;
  timing.sessionMesuree((req,res,next)=>next(),{},res,()=>calls++);assert.equal(headers.length,0);
  process.env.TASKLY_PERF_TIMING='true';const err=Error('confidential');timing.sessionMesuree((req,res,next)=>next(err),{},res,e=>{assert.equal(e,err);calls++;});
  assert.equal(calls,2);assert.equal(headers[0][0],'Server-Timing');assert.match(headers[0][1],/^session_middleware;dur=\d+\.\d{2}$/);assert.ok(!JSON.stringify(headers).includes('confidential'));
  timing.mesurer({...res,headersSent:true},'session_save',process.hrtime.bigint());assert.equal(headers.length,1);
 }finally{if(previous===undefined)delete process.env.TASKLY_PERF_TIMING;else process.env.TASKLY_PERF_TIMING=previous;}
});
