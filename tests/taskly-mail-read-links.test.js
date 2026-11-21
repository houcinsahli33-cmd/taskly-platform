'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createNotifications,configured,origin,hash}=require('../server/services/professionalMailNotifications');
const {mount,page}=require('../server/routes/professionalMailReadRoutes');
const env={TASKLY_MAIL_PILOT_ENABLED:'true',TASKLY_MAIL_INTERNAL_ENABLED:'true',TASKLY_MAIL_READ_LINK_ENABLED:'true',TASKLY_MAIL_GATEWAY_ENABLED:'false',PUBLIC_SITE_URL:'https://taskly.example.test',CRON_SECRET:'s'.repeat(40)};
function harness(){
 const address='artisan@plomberie.taskly.test',pers='private@example.test',state={status:'pending',attempts:0,used_at:null,retry_due:1,expired:false,blocked:false,trashed:false,email:pers},msg={message_id:'message-1',folder:'inbox',from_address:'client@client.taskly.test',to_address:address,subject:'Private subject',body:'<script>private body</script>'};const emails=[],queries=[];let fail=false;
 const conn={query:async(sql,p)=>{queries.push([sql,p]);
  if(sql.startsWith('INSERT INTO taskly_mail_read_notifications'))return [{affectedRows:1}];
  if(sql.startsWith('SELECT notify_email FROM taskly_mail_preferences'))return [[{notify_email:1}]];
  if(sql.startsWith('SELECT status,attempts'))return [[state]];
  if(sql.startsWith('SELECT * FROM taskly_professional_mail_messages')){assert.deepEqual(p,[5,'message-1']);return [state.trashed?[]:[msg]];}
  if(sql.includes("SET status='sending'")){state.status='sending';state.attempts++;state.token_hash=p[0];state.email_hash=p[1];state.retry_due=0;return [{affectedRows:1}];}
  if(sql.includes("SET status='failed'")){state.status='failed';state.token_hash=null;return [{affectedRows:1}];}
  if(sql.includes("SET status='cancelled'")){state.status='cancelled';state.token_hash=null;return [{affectedRows:1}];}
  if(sql.includes("SET status='sent'")){state.status='sent';return [{affectedRows:1}];}
  if(sql.startsWith('SELECT owner_user_id,message_id')&&sql.includes('token_hash='))return [p[0]===state.token_hash?[{owner_user_id:5,message_id:'message-1'}]:[]];
  if(sql.startsWith('SELECT email_hash'))return [!state.used_at&&!state.expired&&p[2]===state.token_hash?[{email_hash:state.email_hash}]:[]];
  if(sql.includes('SET used_at=')){if(state.used_at||state.expired)return [{affectedRows:0}];state.used_at=true;return [{affectedRows:1}];}
  if(sql.startsWith('UPDATE taskly_professional_mail_messages'))return [{affectedRows:1}];
  throw Error('Unhandled SQL '+sql);
 }};
 // Serialize mock transactions; actual TiDB locks must be tested separately.
 let tail=Promise.resolve();const transaction=fn=>{const p=tail.then(()=>fn(conn));tail=p.catch(()=>{});return p;};
 const svc=createNotifications({transaction,env,active:async(c,id)=>{assert.equal(id,5);if(state.blocked)throw Object.assign(Error('blocked'),{status:403});return {address,notificationEmail:state.email};},format:m=>({subject:m.subject,body:m.body,from:m.from_address,to:m.to_address}),send:async(to,mail)=>{emails.push({to,...mail});if(fail)throw Error('SMTP unavailable');}});
 return {svc,state,emails,queries,fail:()=>fail=true,recover:()=>fail=false,token:()=>emails.at(-1).text.match(/consulter#([0-9a-f]{64})/)[1]};
}
test('Read links: opt-in and trusted HTTPS origin only',()=>{assert.equal(configured(env),true);assert.equal(configured({...env,TASKLY_MAIL_READ_LINK_ENABLED:'false'}),false);assert.equal(configured({...env,TASKLY_MAIL_GATEWAY_ENABLED:'true'}),false);for(const u of ['http://example.test','https://x:y@example.test','https://example.test/path','https://example.test/?x=1'])assert.equal(origin({...env,PUBLIC_SITE_URL:u}),null);});
test('Read links: generic external email, current verified address, hash only',async()=>{const h=harness();assert.equal(await h.svc.deliver(5,'message-1'),true);assert.equal(h.emails[0].to,'private@example.test');assert.equal(h.state.token_hash,hash(h.token()));assert.notEqual(h.state.token_hash,h.token());assert.ok(!JSON.stringify(h.queries).includes(h.token()));assert.ok(!h.emails[0].text.includes('Private subject'));assert.ok(!h.emails[0].html.includes('private body'));assert.ok(!h.emails[0].html.includes('private@example.test'));});
test('Read links: one message, one redemption, no other data',async()=>{const h=harness();await h.svc.deliver(5,'message-1');const token=h.token();const results=await Promise.allSettled([h.svc.redeem(token),h.svc.redeem(token)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const m=results.find(r=>r.status==='fulfilled').value;assert.equal(m.subject,'Private subject');assert.equal(m.body,'<script>private body</script>');assert.deepEqual(Object.keys(m).sort(),['body','from','subject','to']);assert.equal(results.find(r=>r.status==='rejected').reason.status,404);});
test('Read links: malformed, expired, blocked, changed email, trash all refused',async()=>{for(const change of [{expired:true},{blocked:true},{email:'other@example.test'},{trashed:true}]){const h=harness();await h.svc.deliver(5,'message-1');Object.assign(h.state,change);await assert.rejects(h.svc.redeem(h.token()),{status:404});assert.equal(h.state.used_at,null);}await assert.rejects(harness().svc.redeem('x'),{status:404});});
test('Read links: repeated delivery does not resend successful notice',async()=>{const h=harness();await h.svc.deliver(5,'message-1');assert.equal(await h.svc.deliver(5,'message-1'),false);assert.equal(h.emails.length,1);});
test('Read links: SMTP failure revokes token; retry issues a new one',async()=>{const h=harness();h.fail();assert.equal(await h.svc.deliver(5,'message-1'),false);const old=h.token();assert.equal(h.state.token_hash,null);await assert.rejects(h.svc.redeem(old),{status:404});h.recover();h.state.retry_due=1;assert.equal(await h.svc.deliver(5,'message-1'),true);assert.notEqual(h.token(),old);});
test('Read links: no automatic consumption, safe text rendering and no GET redemption',()=>{assert.match(page,/button.addEventListener\('click'/);assert.match(page,/credentials:'omit'/);assert.match(page,/\.textContent=m\[key\]/);assert.doesNotMatch(page,/\.innerHTML/);const routes=[];mount({get:(p,...h)=>routes.push(['GET',p,h]),post:(p,...h)=>routes.push(['POST',p,h])},{env,redeem:async()=>({}),retry:async()=>0,limiter:()=>()=>{}});assert.ok(routes.some(([m,p])=>m==='POST'&&p==='/api/taskly-mail/consultation'));assert.ok(!routes.some(([m,p])=>m==='GET'&&p==='/api/taskly-mail/consultation'));});
test('Read links: routes deny cross-origin requests, cron requires secret',async()=>{const routes={};let count=0;mount({get:(p,...h)=>routes[p]=h.at(-1),post:(p,...h)=>routes[p]=h.at(-1)},{env,redeem:async()=>{count++;return {subject:'OK'}},retry:async()=>{count++;return 1},limiter:()=>()=>{}});const response=()=>({code:200,set(){return this;},status(n){this.code=n;return this;},json(v){this.value=v;return this;},end(){return this;}});let res=response();await routes['/api/taskly-mail/consultation']({get:()=> 'https://wrong.example.test',is:()=>true,body:{}},res);assert.equal(res.code,403);res=response();await routes['/api/internal/taskly-mail-notifications']({get:()=>''},res);assert.equal(res.code,404);assert.equal(count,0);res=response();await routes['/api/taskly-mail/consultation']({get:()=>env.PUBLIC_SITE_URL,is:()=>true,body:{token:'a'.repeat(64)}},res);assert.equal(res.value.message.subject,'OK');assert.equal(count,1);});
test('Read links: send saves both copies and durable notification before SMTP; response contains no personal address',async()=>{
 const {createInternalGateway}=require('../server/services/professionalMailInternal');const events=[];const addresses={1:'client@client.taskly.test',2:'artisan@plomberie.taskly.test'};let digest,committed=false,id;
 const conn={query:async(sql,p)=>{
  if(sql.startsWith('SELECT user_id FROM taskly_professional_mailboxes'))return [[{user_id:2}]];
  if(sql.startsWith('SELECT notify_email FROM taskly_mail_preferences'))return [[{notify_email:1}]];
  if(sql.includes('SELECT m.*'))return [[{user_id:p[0],address:addresses[p[0]],proposed_address:addresses[p[0]],provider_id:'internal:'+'a'.repeat(64)}]];
  if(sql.includes('SELECT message_id, to_address'))return [[]];
  if(sql.startsWith('INSERT INTO taskly_professional_mail_messages')){events.push('copies');id=p[1];assert.equal(p[0],1);assert.equal(p[7],2);return [{affectedRows:2}];}
  if(sql.startsWith('INSERT INTO taskly_mail_read_notifications')){events.push('outbox');assert.deepEqual(p,[2,id]);return [{affectedRows:1}];}
  if(sql.startsWith('SELECT status,attempts'))return [[{status:'pending',attempts:0,retry_due:1}]];
  if(sql.startsWith('SELECT * FROM taskly_professional_mail_messages'))return [[{to_address:addresses[2]}]];
  if(sql.includes("SET status='sending'")){digest=p[0];return [{affectedRows:1}];}
  if(sql.includes("SET status='sent'"))return [{affectedRows:1}];
  throw Error('Unexpected '+sql);
 }};
 const g=createInternalGateway({transaction:async fn=>{const r=await fn(conn);if(events.includes('outbox'))committed=true;return r;},profil:async(c,i)=>({id:i,email:'current'+i+'@example.test'}),correspond:()=>true,env,enableNotifications:true,sendNotification:async(to,mail)=>{assert.equal(committed,true);assert.equal(to,'current2@example.test');assert.equal(hash(mail.text.match(/consulter#([a-f0-9]{64})/)[1]),digest);events.push('smtp');}});
 const response=await g.send({user_id:1,address:addresses[1],provider_id:'internal:'+'a'.repeat(64)},{to:addresses[2],subject:'Bonjour',body:'Message',key:'00000000-0000-4000-8000-000000000001'});
 assert.deepEqual(events,['copies','outbox','smtp']);assert.deepEqual(response,{id});
});
