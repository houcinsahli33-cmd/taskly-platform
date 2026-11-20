'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {surveiller,actualiserBadge,normalize,marker}=require('../client/public/js/taskly-disponibilite');
const read=p=>fs.readFileSync(p,'utf8');
function fakeClock(){
 const timers=new Map();let id=0;
 const host=new EventTarget();host.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};host.clearTimeout=i=>timers.delete(i);
 const doc=new EventTarget();doc.hidden=false;
 return {host,doc,timers,async run(ms){const pair=[...timers].find(([,x])=>x.ms===ms);assert.ok(pair,`No timer ${ms}`);timers.delete(pair[0]);return pair[1].fn();}};
}
test('Sync : une seule lecture simultanée, prochaine lecture après 30 s',async()=>{
 const f=fakeClock();let finish,calls=0;const stop=surveiller(()=>{calls++;return new Promise(r=>finish=r);},f.doc,f.host);
 const pending=f.run(30000);f.host.dispatchEvent(new Event('focus'));assert.equal(calls,1);assert.deepEqual([...f.timers.values()].map(x=>x.ms),[12000]);finish();await pending;assert.equal([...f.timers.values()][0].ms,30000);stop();assert.equal(f.timers.size,0);
});
test('Sync : onglet masqué, requête annulée, reprise au retour',async()=>{
 const f=fakeClock();let signal;const stop=surveiller(s=>{signal=s;return new Promise((_,reject)=>s.addEventListener('abort',()=>reject(Error('abort'))));},f.doc,f.host);
 const pending=f.run(30000);f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(signal.aborted,true);await pending;assert.equal(f.timers.size,0);f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.timers.size,1);stop();
});
test('Sync : échec et retour progressif, délai maximal de 120 s',async()=>{
 const f=fakeClock();let n=0;const stop=surveiller(async()=>{if(++n<=3)throw Error('offline');},f.doc,f.host);
 for(const ms of [30000,60000,120000,120000])await f.run(ms);assert.equal([...f.timers.values()][0].ms,30000);stop();
});
test('Sync : délai de requête borné et abort réel',async()=>{
 const f=fakeClock();let signal;const stop=surveiller(s=>{signal=s;return new Promise((_,reject)=>s.addEventListener('abort',()=>reject(Error('timeout'))));},f.doc,f.host);
 const p=f.run(30000);await f.run(12000);await p;assert.equal(signal.aborted,true);assert.equal([...f.timers.values()][0].ms,60000);stop();
});
test('Sync : badge non vérifié après échec et récupération du statut réel',()=>{
 const node={innerHTML:'',badge:{textContent:''},querySelector(){return this.badge;}};actualiserBadge(node,null);assert.equal(node.badge.textContent,'Statut non vérifié');assert.match(node.innerHTML,/ta-non_renseignee/);
 const a={disponibilite_statut:'disponible',disponibilite_secondes:3600,intervention_rapide:1};actualiserBadge(node,a);assert.match(node.innerHTML,/Intervention rapide/);assert.equal(marker([a,{...a,intervention_en_cours:1}]),'mixte');assert.equal(normalize({...a,intervention_en_cours:1}).rapide,false);
});
function profileFixture(result){
 const badge={isConnected:true},paints=[],requests=[];const ctx={document:{hidden:false,addEventListener(){},querySelector:()=>badge},window:{TasklyDisponibilite:{actualiserBadge:(el,a)=>paints.push(a)}},obtenirParametre:()=> '7',requeteAPI:async(u,o)=>{requests.push([u,o]);return result();},console,URLSearchParams};vm.createContext(ctx);vm.runInContext(read('client/public/js/artisans.js'),ctx);return {ctx,paints,requests};
}
test('Sync : profil public ne modifie que son badge, identifiant contrôlé, no-store',async()=>{
 const a={id:7,disponibilite_statut:'occupe'},f=profileFixture(()=>({artisan:a}));await f.ctx.actualiserProfilPublic(new AbortController().signal);assert.deepEqual(f.paints,[a]);assert.equal(f.requests[0][0],'/api/artisans/7');assert.equal(f.requests[0][1].cache,'no-store');const wrong=profileFixture(()=>({artisan:{id:8}}));await assert.rejects(wrong.ctx.actualiserProfilPublic(new AbortController().signal));assert.deepEqual(wrong.paints,[null]);
});
test('Sync : réponse obsolète après annulation ne repeint pas le badge',async()=>{
 const f=profileFixture(()=>({artisan:{id:7}}));const c=new AbortController();c.abort();await f.ctx.actualiserProfilPublic(c.signal);assert.equal(f.paints.length,0);
});
