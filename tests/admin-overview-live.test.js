'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
function charger(relative, mocks) {
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,relative),'utf8'),{
    module,exports:module.exports,console,Buffer,Date,Map,
    require:id => id in mocks ? mocks[id] : require(id)
  },{filename:relative});
  return module.exports;
}
function modeleSimule(jour='2026-10-11',donnees=[]) {
  const requetes=[];
  const db={promise:()=>({query:async(sql,args)=>{
    requetes.push({sql,args});
    if(sql.includes('AS reference'))return [[{reference:jour}]];
    if(sql.includes('SUM(CASE'))return [donnees];
    if(sql.includes('verification_statut'))return [[{total:4}]];
    throw new Error('SQL inattendu: '+sql);
  }})};
  const model=charger('server/models/adminModel.js',{
    '../config/db':db,
    '../models/signalementModel':{},
    '../models/contactModel':{}
  });
  return {model,requetes};
}

test('Vue ensemble : sept jours complets, dates vides à zéro et rôles séparés',async()=>{
  const {model,requetes}=modeleSimule('2026-10-11',[
    {periode:'2026-10-09',artisans:'2',clients:'3'},
    {periode:'2026-10-11',artisans:'1',clients:'0'}
  ]);
  const points=await model.inscriptionsParPeriode('7j');
  assert.equal(points.length,7);
  assert.deepEqual(JSON.parse(JSON.stringify(points[0])),{periode:'2026-10-05',artisans:0,clients:0});
  assert.deepEqual(JSON.parse(JSON.stringify(points[4])),{periode:'2026-10-09',artisans:2,clients:3});
  assert.deepEqual(JSON.parse(JSON.stringify(points[6])),{periode:'2026-10-11',artisans:1,clients:0});
  assert.match(requetes[1].sql,/role IN \('artisan', 'client'\)/);
  assert.match(requetes[1].sql,/INTERVAL 6 DAY/);
});

test('Vue ensemble : trente jours consécutifs, y compris changement de mois',async()=>{
  const {model}=modeleSimule('2026-03-02');
  const points=await model.inscriptionsParPeriode('30j');
  assert.equal(points.length,30);
  assert.equal(points[0].periode,'2026-02-01');
  assert.equal(points.at(-1).periode,'2026-03-02');
});

test('Vue ensemble : douze mois sur une année glissante',async()=>{
  const {model,requetes}=modeleSimule('2026-10-11',[{periode:'2025-11',artisans:1,clients:1}]);
  const points=await model.inscriptionsParPeriode('12m');
  assert.equal(points.length,12);
  assert.equal(points[0].periode,'2025-11');
  assert.equal(points.at(-1).periode,'2026-10');
  assert.equal(points[0].artisans,1);
  assert.match(requetes[1].sql,/INTERVAL 11 MONTH/);
});

test('Vue ensemble : aucune période arbitraire injectable en SQL',async()=>{
  const {model,requetes}=modeleSimule();
  await assert.rejects(model.inscriptionsParPeriode("7j'; DROP TABLE users; --"),{name:'RangeError'});
  assert.equal(requetes.length,0);
});

test('Vue ensemble : API valide la période et garde la panne de vérification isolée',async()=>{
  const ctrl=charger('server/controllers/adminController.js',{
    '../models/adminModel':{
      inscriptionsParPeriode:async p=>[{periode:'2026-10-11',artisans:1,clients:0}],
      compterArtisansEnAttente:async()=>{throw new Error('migrating');}
    },
    '../models/serviceModel':{}
  });
  const makeRes=()=>({code:null,body:null,status(code){this.code=code;return this},json(obj){this.body=obj;return this}});
  let res=makeRes();await ctrl.inscriptionsParPeriode({query:{periode:'invalide'}},res);
  assert.equal(res.code,400);
  res=makeRes();const original=console.error;console.error=()=>{};
  try {await ctrl.inscriptionsParPeriode({query:{periode:'7j'}},res);}finally {console.error=original;}
  assert.equal(res.code,200);
  assert.equal(res.body.points[0].artisans,1);
  assert.equal(res.body.artisansEnAttente,null);
});

test('Vue ensemble : barre latérale identique à Utilisateurs, API protégée',()=>{
  const html=fs.readFileSync(path.join(root,'client/private/admin/overview.html'),'utf8');
  const users=fs.readFileSync(path.join(root,'client/private/admin/users.html'),'utf8');
  for(const p of ['overview','users','reports','contacts','services','verification','site','account','admins']){
    assert.match(html,new RegExp('data-admin-tab="'+p+'"'));
    assert.match(users,new RegExp('data-admin-tab="'+p+'"'));
  }
  assert.match(html,/href="\/css\/admin-users-page\.css"/);
  assert.match(html,/class="dashboard-page admin-users-page admin-overview-page"/);
  assert.match(html,/id="admin-stats-grid"/);
  const routes=fs.readFileSync(path.join(root,'server/routes/adminRoutes.js'),'utf8');
  assert.match(routes,/router\.use\(verifierConnexion, verifierAdmin\)/);
  assert.match(routes,/router\.get\("\/stats\/inscriptions", adminController\.inscriptionsParPeriode\)/);
});
