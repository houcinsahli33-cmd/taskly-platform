const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function simulerModele() {
  const requetes=[];
  const db={promise:()=>({query:async(sql,params=[])=>{
    requetes.push({sql,params});
    if(sql.includes('COUNT(*) AS total') && /FROM artisans a\s+JOIN/.test(sql))return [[{total:37}]];
    return [[{id:10,prenom:'Nadia',nom:'Ben',service_nom:'Peinture'}]];
  }})};
  const module={exports:{}};
  const code=fs.readFileSync(path.join(__dirname,'../server/models/artisanModel.js'),'utf8');
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>{
    if(name==='../config/db')return db;
    if(name==='../helpers/algeriaLocations')return {obtenirCommunesWilaya:()=>[]};
    throw Error('Module inattendu : '+name);
  },console,Number,Array,Set});
  return {modele:module.exports,requetes};
}
test('annuaire public paginé : 37 artisans accessibles, jamais limités aux six premières cartes',async()=>{
  const {modele,requetes}=simulerModele();
  const res=await modele.trouverTousLesArtisans({}, {page:2,limit:12});
  assert.equal(res.total,37);
  assert.equal(res.totalPages,4);
  assert.equal(res.page,2);
  assert.equal(res.limit,12);
  assert.equal(requetes.length,2);
  assert.equal(requetes[0].params.at(-2),12);
  assert.equal(requetes[0].params.at(-1),12);
  assert.match(requetes[0].sql,/verification_statut = 'approuve'/);
  assert.match(requetes[0].sql,/email_verified = 1/);
  assert.match(requetes[0].sql,/statut_compte = 'actif'/);
});
test('filtres envoyés avec paramètres SQL sans interpolation directe',async()=>{
  const {modele,requetes}=simulerModele();
  await modele.trouverTousLesArtisans({recherche:"%' OR 1=1 --",serviceId:4}, {page:1,limit:36});
  assert.equal(requetes[0].params.at(-2),36);
  assert.ok(requetes[0].params.includes(4));
  assert.ok(requetes[0].params.some(v=>String(v).includes('OR 1=1')));
  assert.ok(!requetes[0].sql.includes('OR 1=1'));
});
