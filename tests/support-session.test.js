const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),express=require('express');
const request=require('./helpers/request');
for(const scenario of [{name:'session ancienne sans version',version:undefined,verified:1},{name:'version révoquée',version:3,verified:1},{name:'adresse non confirmée',version:4,verified:0}])test('support limité : '+scenario.name,async()=>{
 const module={exports:{}},identity={userId:42,version:scenario.version,verifiedAt:Date.now(),expiresAt:Date.now()+60000};
 const mocks={'../config/db':{promise:()=>({query:async()=>[[{id:42,role:'artisan',email_verified:scenario.verified,admin_session_version:4}]]})},'../middleware/securityMiddleware':{limiter:()=>((q,s,n)=>n())},'../middleware/documentUpload':{upload:{single:()=>((q,s,n)=>n())}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../server/routes/artisanSupportRoutes'),'utf8'),{module,require:n=>mocks[n]||require(n),Date,console,process});
 const app=express();app.use((q,s,n)=>{q.session={supportIdentity:identity};n();});app.use(module.exports);
 const result=await request(app,'/context');assert.equal(result.status,401);assert.match((await result.json()).message,/Reconnectez-vous/);
});
