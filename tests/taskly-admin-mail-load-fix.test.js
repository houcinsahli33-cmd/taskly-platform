'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
function harness({v10=false,failMailbox=false,joined=true}={}){
 const routes=new Map(),queries=[];
 const mockRouter=()=>({use(){},get(uri,...handlers){routes.set(uri,handlers.at(-1));},post(){}});
 const demands=[
  {user_id:450002,proposed_address:'a@client.taskly.dz',status:'approved_pending_provider'},
  {user_id:480002,proposed_address:'b@plomberie.taskly.dz',status:'approved_pending_provider'},
  {user_id:570002,proposed_address:'c@serrurerie.taskly.dz',status:'approved_pending_provider'}
 ];
 const pool={query:async(sql,args)=>{
  queries.push([sql,args]);
  if(sql.includes('FROM taskly_professional_mail_requests')){
   assert.ok(!sql.includes('JOIN'));
   assert.deepEqual(Array.from(args),[0]);
   return [demands.map(d=>({...d}))];
  }
  if(sql.includes('FROM taskly_professional_mailboxes')){
   if(failMailbox)throw Object.assign(new Error('Simulated SQL parser failure'),{code:'ER_PARSE_ERROR'});
   assert.equal((sql.match(/\?/g)||[]).length,3);
   assert.deepEqual(Array.from(args),[450002,480002,570002]);
   return [[
    {user_id:450002,address:'a@client.taskly.dz',activated_at:new Date(),suspended_at:null},
    {user_id:480002,address:'b@plomberie.taskly.dz',activated_at:null,suspended_at:null},
    {user_id:570002,address:'c@serrurerie.taskly.dz',activated_at:new Date(),suspended_at:v10?new Date():null}
   ]];
  }
  throw Error('Unexpected SQL');
 }};
 const module={exports:{}};
 const mocks={
  express:{Router:mockRouter},
  '../config/db':{promise:()=>pool},
  '../middleware/authMiddleware':{verifierConnexion(){},verifierArtisan(){},verifierAdmin(){}},
  '../middleware/securityMiddleware':{limiter:()=>()=>{}},
  '../services/professionalMailPolicy':{},
  '../services/professionalMailGateway':{createGateway:()=>({configured:joined})},
  '../services/professionalMailAccess':{modeGeneral:()=>true,modeClient:()=>false},
  './professionalMailboxRoutes':{mount(){}}
 };
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'server/routes/professionalMailRoutes.js'),'utf8'),{
  module,require:x=>mocks[x]||require(x),console:{error(){}},process:{env:{TASKLY_ADMIN_MAIL_V10_ENABLED:v10?'true':'false'}},Map,Set
 });
 const res={statusCode:200,status(code){this.statusCode=code;return this;},json(result){this.data=result;return this;}};
 return {queries,res,run:async()=>routes.get('/')({query:{after:'0'}},res)};
}
test('Admin listings: preserve all three requests, active, activation_required, waiting_provider',async()=>{
 const h=harness();await h.run();assert.equal(h.res.statusCode,200);
 assert.equal(h.res.data.demandes.length,3);
 assert.deepEqual(Array.from(h.res.data.demandes,d=>d.mailbox_state),['active','activation_required','active']);
 assert.equal(h.res.data.adminActionsV10,false);
});
test('V10 suspension remains visible and reversible actions only when state lookup succeeds',async()=>{
 const h=harness({v10:true});await h.run();
 assert.equal(h.res.statusCode,200);
 assert.equal(h.res.data.demandes[2].mailbox_state,'suspended');
 assert.equal(h.res.data.adminActionsV10,true);
});
test('Parser error in secondary status lookup does not hide the three requests or grant actions',async()=>{
 const h=harness({v10:true,failMailbox:true});await h.run();
 assert.equal(h.res.statusCode,200);
 assert.equal(h.res.data.demandes.length,3);
 assert.equal(h.res.data.mailboxStateUnavailable,true);
 assert.equal(h.res.data.adminActionsV10,false);
 assert.ok(h.res.data.demandes.every(d=>d.mailbox_state===null));
});
test('No gateway: do not query mailbox states',async()=>{
 const h=harness({joined:false});await h.run();
 assert.equal(h.res.statusCode,200);assert.equal(h.queries.length,1);
});
test('Only V10 script owns mail panel rendering; V6 still owns existing tab controls',()=>{
 const v6=fs.readFileSync(path.join(ROOT,'client/public/js/taskly-mail-admin-validated-v6.js'),'utf8');
 assert.match(v6,/function chooseTab\(i\)/);
 assert.match(v6,/V10 controller owns the administrative mailbox panel/);
 assert.match(v6,/return;\s*const folderPanel=/);
});
