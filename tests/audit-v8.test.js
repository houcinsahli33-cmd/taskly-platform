'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {creerCachePublic}=require('../server/services/siteSettings');
const {ROUTES,cible,sessionsValides,bilan,parcours}=require('../scripts/performance-budget');
test('paramètres publics : lectures simultanées mutualisées, copie isolée et expiration',async()=>{
 let calls=0,time=0;const c=creerCachePublic(async()=>({email:'test'+(++calls)+'@example.com'}),()=>time,10000);
 const [a,b]=await Promise.all([c.lire(),c.lire()]);assert.equal(calls,1);a.email='modifie';assert.notEqual(a.email,b.email);assert.equal((await c.lire()).email,b.email);time=10001;await c.lire();assert.equal(calls,2);
});
test('paramètres publics : invalidation ne réinstalle pas une ancienne lecture en cours',async()=>{
 let fin,calls=0;const c=creerCachePublic(()=>++calls===1?new Promise(r=>fin=r):Promise.resolve({email:'nouveau'}));
 const old=c.lire();await Promise.resolve();c.invalider();assert.equal((await c.lire()).email,'nouveau');fin({email:'ancien'});await old;assert.equal((await c.lire()).email,'nouveau');
});
test('paramètres publics : les échecs ne sont pas mémorisés',async()=>{
 let calls=0;const c=creerCachePublic(async()=>{if(++calls===1)throw Error('panne');return {email:'ok'};});await assert.rejects(c.lire());assert.equal((await c.lire()).email,'ok');
});
test('budget : production, redirections implicites et sessions dupliquées refusées',()=>{
 const env={TASKLY_PERF_TEST:'ISOLATED_PREVIEW_ONLY',PREVIEW_HOST:'taskly-platform-sigma.vercel.app',TARGET_URL:'https://taskly-platform-sigma.vercel.app'};assert.throws(()=>cible(env));assert.equal(cible({...env,TARGET_URL:'http://localhost:3000'}),'http://localhost:3000');assert.throws(()=>cible({...env,TARGET_URL:'http://localhost:3000/a'}));assert.throws(()=>sessionsValides(['artisans.sid=x','artisans.sid=x']));assert.throws(()=>sessionsValides(['taskly.admin.sid=x']));
});
test('budget : cinq objectifs exacts, p95 et taux erreur bloquants',()=>{
 assert.deepEqual(ROUTES.map(r=>r.budget),[200,300,400,200,300]);const r=ROUTES[0];const m=Array.from({length:20},()=>({ms:200,ok:true}));assert.equal(bilan(r,m).respecte,true);m[18].ms=201;m[19].ms=201;assert.equal(bilan(r,m).respecte,false);m[18].ok=false;assert.equal(bilan(r,m).respecte,false);assert.equal(bilan(r,m.slice(0,19)).respecte,false);
});
test('budget : parcours utilise CSRF réel de la réponse et vérifie les corps',async()=>{
 const bodies=[{csrfToken:'a'.repeat(64)},{utilisateur:{role:'artisan'}},{demandes:[]},{parametres:{email:'x@y.z'}},null];let n=0;
 const r=await parcours({base:'http://localhost',cookie:'artisans.sid=fictif',fetcher:async(url,opts)=>{assert.equal(opts.redirect,'manual');const i=n++;if(i===4)assert.equal(opts.headers['X-CSRF-Token'],'a'.repeat(64));return {status:i===4?204:200,text:async()=>i===4?'':JSON.stringify(bodies[i])};}});assert.equal(r.length,5);assert.ok(r.every(x=>x.ok));
});
