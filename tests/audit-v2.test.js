'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function charger(p,mocks={},env={}){const module={exports:{}};vm.runInNewContext(read(p),{module,exports:module.exports,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),Buffer,console,process:{env,hrtime:process.hrtime}});return module.exports;}
function res(){return {code:200,headers:{},status(n){this.code=n;return this;},json(d){this.data=d;return this;},set(n,v){this.headers[n]=v;return this;},append(n,v){this.headers[n]=v;return this;}};}
function req(role='artisan'){return {session:{utilisateur:{id:7,role},adminVerified:true,adminSessionVersion:1,accountSessionVersion:1,destroy(){}}};}
test('Artisan : une lecture utilisateur + une lecture profil par requête, révocation recontrôlée à la suivante',async()=>{
 let users=0,artisans=0,statut='approuve';const mw=charger('server/middleware/authMiddleware.js',{'../models/userModel':{trouverUtilisateurParId:async()=>{users++;return {role:'artisan',statut_compte:'actif',email_verified:1,admin_session_version:1};}},'../models/artisanModel':{trouverArtisanParUserId:async()=>{artisans++;return {verification_statut:statut};}},'../services/accountAccess':{autoriserEspace:(u,a)=>a.verification_statut==='approuve'}},{TASKLY_PERF_TIMING:'true'});
 const r=req(),s=res();let n=0;await mw.verifierConnexion(r,s,()=>n++);await mw.verifierArtisanActif(r,s,()=>n++);assert.equal(n,2);assert.equal(users,1);assert.equal(artisans,1);assert.match(s.headers['Server-Timing'],/auth_artisan_sql;dur=/);
 statut='refuse';const s2=res();await mw.verifierConnexion(req(),s2,()=>n++);assert.equal(s2.code,403);assert.equal(n,2);assert.equal(users,2);assert.equal(artisans,2);
});
test('Admin : une lecture utilisateur, deuxième requête contrôle la révocation et adminVerified reste exigé',async()=>{
 let reads=0,version=1;const mw=charger('server/middleware/authMiddleware.js',{'../models/userModel':{trouverUtilisateurParId:async()=>{reads++;return {role:'admin',statut_compte:'actif',email_verified:1,admin_session_version:version};}}});const r=req('admin'),s=res();let n=0;await mw.verifierConnexion(r,s,()=>n++);await mw.verifierAdmin(r,s,()=>n++);assert.equal(reads,1);assert.equal(n,2);r.session.adminVerified=false;await mw.verifierAdmin(r,res(),()=>n++);assert.equal(n,2);
 version=2;const s2=res();await mw.verifierAdmin(req('admin'),s2,()=>n++);assert.equal(s2.code,403);assert.equal(reads,2);
});
const env={NODE_ENV:'production',SESSION_SECRET:'x'.repeat(48)};
const request=(id='1',ip='192.0.2.10')=>({baseUrl:'/api/admin',path:'/messages/'+id,route:{path:'/messages/:id'},ip});
test('Limiteur distribué : quota commun entre instances simulées et identifiants de route variables',async()=>{
 const counts=new Map(),keys=[];const mock={'../config/sessionStore':{obtenirClientRedis:()=>({eval:async(script,{keys:[key],arguments:[ttl]})=>{keys.push(key);const n=(counts.get(key)||0)+1;counts.set(key,n);return [n,Number(ttl)];}})}};
 const a=charger('server/middleware/securityMiddleware.js',mock,env).limiter({max:2,fenetre:5000}),b=charger('server/middleware/securityMiddleware.js',mock,env).limiter({max:2,fenetre:5000});let n=0;await a(request('1'),res(),()=>n++);await b(request('2'),res(),()=>n++);const s=res();await a(request('3'),s,()=>n++);assert.equal(n,2);assert.equal(s.code,429);assert.equal(s.headers['Retry-After'],'5');assert.equal(keys[0],keys[1]);assert.equal(keys[1],keys[2]);assert.doesNotMatch(keys[0],/192\.0\.2\.10/);await b(request('4','192.0.2.11'),res(),()=>n++);assert.equal(n,3);
});
test('Limiteur production : panne Redis, compteur invalide ou secret absent refusent la requête',async()=>{
 for(const [redis,e] of [[null,env],[{eval:async()=>{throw Error('panne');}},env],[{eval:async()=>[0,-1]},env],[{eval:async()=>[1,5000]},{NODE_ENV:'production'}]]){const mw=charger('server/middleware/securityMiddleware.js',{'../config/sessionStore':{obtenirClientRedis:()=>redis}},e).limiter();const s=res();await mw(request(),s,()=>assert.fail('accès autorisé'));assert.equal(s.code,503);}
});
test('Limiteur local : le quota est conservé sans Redis en développement',async()=>{const mw=charger('server/middleware/securityMiddleware.js').limiter({max:1});let n=0;await mw(request(),res(),()=>n++);const s=res();await mw(request(),s,()=>n++);assert.equal(n,1);assert.equal(s.code,429);});
test('Ressources publiques : seules les ressources fixes passent avant la session locale',()=>{
 const {publicAssets}=require('../server/middleware/publicFiles');let sent=0,passed=0;const s={setHeader(){},sendFile(name,opts,cb){sent++;assert.match(name,/^css[\\/]style\.css$/);assert.equal(opts.dotfiles,'deny');}};
 publicAssets({method:'GET',path:'/css/style.css'},s,()=>passed++);assert.equal(sent,1);
 for(const url of ['/css/test.html','/css/test.json','/css/test%2Ejson','/api/auth/me','/espace/client/profil','/css/../private/x.js','/images/.env','/admin-dashboard.html'])publicAssets({method:'GET',path:url},s,()=>passed++);assert.equal(passed,8);assert.equal(sent,1);
});
test('Confidentialité : SQL des demandes et du chat ne renvoie le téléphone artisan que si autorisé',async()=>{
 const qs=[];const mock={'../config/db':{promise:()=>({query:async(sql,args)=>{qs.push(sql);return [[]];}})}};
 await charger('server/models/chatModel.js',mock).trouverDemande(1);await charger('server/models/demandeModel.js',mock).listerDemandesClient(2);
 assert.equal(qs.length,2);for(const sql of qs){assert.match(sql,/CASE WHEN (?:a|artisans)\.afficher_telephone = 1/);assert.match(sql,/verification_statut = 'approuve'/);assert.match(sql,/statut_compte = 'actif'/);assert.match(sql,/email_verified = 1/);assert.match(sql,/ELSE NULL END AS artisan_telephone/);}
});
test('Deux lectures simultanées du profil partagent une requête, pas une lecture ultérieure',async()=>{
 let requests=0,release;const ctx={window:{},location:{pathname:'/espace/client/profil'},document:{addEventListener(){}},fetch:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({compte:{id:7}})};},console};vm.createContext(ctx);vm.runInContext(read('client/public/js/api.js'),ctx);
 const a=ctx.requeteAPI('/api/account'),b=ctx.requeteAPI('/api/account');assert.equal(requests,1);release();assert.equal((await a).compte.id,7);await b;const c=ctx.requeteAPI('/api/account');assert.equal(requests,2);release();await c;
});
