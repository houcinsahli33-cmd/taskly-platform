'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function load(p,mocks={},env={}){const module={exports:{}};vm.runInNewContext(read(p),{module,exports:module.exports,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),Buffer,console,process:{env}});return module.exports;}
function response(){return {code:200,headers:{},status(n){this.code=n;return this;},json(d){this.data=d;return this;},set(n,v){this.headers[n]=v;return this;}};}
const security=require('../server/middleware/securityMiddleware');
const token='a'.repeat(64);
function csrf(method,url,expected,supplied){const r=response();let passed=false;security.verifierCsrf({method,originalUrl:url,session:{csrfToken:expected},get:()=>supplied},r,()=>passed=true);return {code:r.code,passed};}
test('CSRF : toutes les variantes de casse et chemins mutants sont contrôlés une fois montés',()=>{
 for(const url of ['/api/auth/logout','/API/auth/logout','/Api/Auth/Logout/','/api','/chat'])for(const method of ['POST','PUT','DELETE','PATCH']){
  assert.deepEqual(csrf(method,url,token,undefined),{code:403,passed:false});
  assert.deepEqual(csrf(method,url,token,token),{code:200,passed:true});
 }
});
test('CSRF : jeton non conforme, erroné, absent et non hexadécimal refusés',()=>{
 for(const [expected,supplied] of [[token,'b'.repeat(64)],[token,'A'.repeat(64)],[token,'g'.repeat(64)],[token,'a'.repeat(63)],[null,token],[token,['a'.repeat(64)]]])assert.equal(csrf('POST','/api/account',expected,supplied).code,403);
 for(const method of ['GET','HEAD','OPTIONS'])assert.equal(csrf(method,'/api/account',undefined,undefined).passed,true);
});
test('CSRF : réponse explicite non cachable, jeton stable dans la même session',()=>{
 const req={session:{}},a=response(),b=response();security.csrfToken(req,a);security.csrfToken(req,b);assert.match(a.data.csrfToken,/^[a-f0-9]{64}$/);assert.equal(a.headers['Cache-Control'],'private, no-store');assert.equal(a.data.csrfToken,b.data.csrfToken);
});
test('Limiteur : montages et routes équivalents en casse ont un quota commun',async()=>{
 const counts=new Map();const middleware=load('server/middleware/securityMiddleware.js',{'../config/sessionStore':{obtenirClientRedis:()=>({eval:async(_,{keys,arguments:args})=>{const n=(counts.get(keys[0])||0)+1;counts.set(keys[0],n);return [n,Number(args[0])];}})}},{NODE_ENV:'production',SESSION_SECRET:'s'.repeat(48)}).limiter({max:1});
 let passed=0;for(const [baseUrl,routePath,status] of [['/api/auth','/login',200],['/API/AUTH','/LOGIN',429]]){const r=response();await middleware({baseUrl,route:{path:routePath},ip:'192.0.2.1'},r,()=>passed++);assert.equal(r.code,status);}assert.equal(counts.size,1);assert.equal(passed,1);
});
test('Récupération de mot de passe : compteurs Redis invalides bloquent la requête',async()=>{
 for(const value of [[0,1000],[NaN,1000],[1,-1],[1,NaN],[1.5,1000]]){
  const mw=load('server/middleware/passwordResetLimiter.js',{'../config/sessionStore':{obtenirClientRedis:()=>({eval:async()=>value})}},{SESSION_SECRET:'x'.repeat(48)}).limiter();const r=response();await mw({ip:'192.0.2.1',route:{path:'/request'},body:{}},r,()=>assert.fail('Accès autorisé'));assert.equal(r.code,503);
 }
});
test('Récupération de mot de passe : compteur valide et limite de débit',async()=>{
 for(const [n,code] of [[1,200],[6,429]]){const mw=load('server/middleware/passwordResetLimiter.js',{'../config/sessionStore':{obtenirClientRedis:()=>({eval:async()=>[n,1000]})}},{SESSION_SECRET:'x'.repeat(48)}).limiter();const r=response();let passed=false;await mw({ip:'192.0.2.1',route:{path:'/request'},body:{email:'test@example.test'}},r,()=>passed=true);assert.equal(r.code,code);assert.equal(passed,code===200);}
});
test('SMTP : STARTTLS imposé en production et délais bornés, sans contact réseau',async()=>{
 for(const secure of ['true','false']){const env={NODE_ENV:'production',SMTP_SECURE:secure,SMTP_HOST:'smtp.example.test',SMTP_USER:'test',SMTP_PASS:'fake',MAIL_FROM:'test@example.test'};const options=[];const nodemailer={createTransport:o=>{options.push(o);return {sendMail:async()=>{}};}};await load('server/services/emailService.js',{nodemailer},env).envoyerCode('other@example.test','123456','password_reset');await load('server/services/adminMailService.js',{nodemailer},env).envoyerCourrielAdmin('other@example.test','Test','texte');const queue=load('server/services/tasklyMail.js',{nodemailer,'../config/db':{promise:()=>({query:async()=>[[]]})}},env);await queue.traiterLot();assert.equal(options.length,3);for(const o of options){assert.equal(o.secure,secure==='true');assert.equal(o.requireTLS,secure==='false');assert.equal(o.connectionTimeout,8000);assert.equal(o.greetingTimeout,8000);assert.equal(o.socketTimeout,10000);}}
});
// Exécute l'initialisation k6 avec de faux modules, sans le moindre HTTP.
function loadScenario(env){const s=read('scripts/load-test.k6.js').replace(/^import .*$/gm,'').replace('export const options=','const options=').replace('export default function()','function scenario()')+'\nresult=options;';const context={__ENV:env,result:null};vm.runInNewContext(s,context);return context.result;}
test('Charge : exige consentement et refuse production, redirections et montée excessive',()=>{
 for(const env of [{},{TASKLY_LOAD_TEST:'YES',TARGET_URL:'https://taskly-platform-sigma.vercel.app',PREVIEW_HOST:'taskly-platform-sigma.vercel.app'},{TASKLY_LOAD_TEST:'YES',TARGET_URL:'https://example.test',PREVIEW_HOST:'example.test'},{TASKLY_LOAD_TEST:'YES',TARGET_URL:'https://preview.vercel.app'},{TASKLY_LOAD_TEST:'YES',TASKLY_VUS:'1000'}])assert.throws(()=>loadScenario(env));
 const o=loadScenario({TASKLY_LOAD_TEST:'YES'});assert.equal(o.maxRedirects,0);assert.equal(o.stages[0].target,5);assert.equal(loadScenario({TASKLY_LOAD_TEST:'YES',TARGET_URL:'https://preview.vercel.app',PREVIEW_HOST:'preview.vercel.app',TASKLY_VUS:'25'}).stages[0].target,25);
});
