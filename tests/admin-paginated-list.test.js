const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function routesAdmin() {
  const routes={};const requetes=[];const middlewares=[];
  const db={query:async(sql,args=[])=>{
    requetes.push({sql,args});
    if(sql.includes('COUNT(*) AS total') && sql.includes('JOIN services'))return [[{total:347}]];
    if(sql.includes('COALESCE(SUM(a.verification_statut'))return [[{total:357,en_attente:3,a_completer:4,approuve:340,refuse:10,bloque:2}]];
    if(sql.includes('SELECT a.id,a.verification_statut'))return [[{id:340,nom:'Nadir',prenom:'T',verification_statut:'approuve'}]];
    if(sql.includes('SELECT id FROM artisans WHERE id='))return [[{id:340}]];
    if(sql.includes('verification_audit va'))return [[{id:7,ancien_statut:'en_attente',nouveau_statut:'approuve'}]];
    return [[]];
  }};
  const router={use:(...m)=>middlewares.push(...m),get:(route,callback)=>routes['GET '+route]=callback,put:(route,callback)=>routes['PUT '+route]=callback,post:(route,...callbacks)=>routes['POST '+route]=callbacks.at(-1)};
  const module={exports:{}};
  const req=n=>{
    if(n==='express')return {Router:()=>router};
    if(n==='../config/db')return {promise:()=>db};
    if(n==='../middleware/authMiddleware')return {verifierConnexion:()=>{},verifierAdmin:()=>{}};
    if(n==='../middleware/documentUpload')return {dossier:'.'};
    if(n==='../middleware/securityMiddleware')return {limiter:()=>()=>{}};
    return require(n);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/routes/adminVerificationRoutes.js'),'utf8'),{module,exports:module.exports,require:req,console,Number,String,Array,Set,Math,Date});
  return {routes,requetes,middlewares};
}
function reponse() {
  const r={statusCode:200,headers:{},status(n){r.statusCode=n;return r;},set(name,value){r.headers[name]=value;return r;},json(data){r.data=data;return r;}};
  return r;
}
test('administration : plus de 200 artisans accessibles et filtres paramétrés',async()=>{
  const {routes,requetes,middlewares}=routesAdmin();
  assert.equal(middlewares.length,2);
  const res=reponse();
  await routes['GET /artisans']({query:{page:'12',limite:'30',statut:'approuve',recherche:'Nadir'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.data.total,347);
  assert.equal(res.data.pages,12);
  assert.equal(res.data.page,12);
  assert.equal(res.data.comptes.bloque,2);
  const liste=requetes.find(q=>q.sql.includes('SELECT a.id,a.verification_statut'));
  assert.ok(liste.sql.includes('LIMIT ? OFFSET ?'));
  assert.ok(!liste.sql.includes('LIMIT 200'));
  assert.equal(liste.args.at(-2),30);
  assert.equal(liste.args.at(-1),330);
  assert.ok(liste.args.includes('approuve'));
  assert.ok(liste.args.includes('%Nadir%'));
});
test('dossier admin : justificatifs, support, notifications et historique',async()=>{
  const {routes,requetes}=routesAdmin();
  const res=reponse();
  await routes['GET /artisans/:id/documents']({params:{id:'340'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.data.historique[0].nouveau_statut,'approuve');
  assert.ok(requetes.some(q=>q.sql.includes('contacts_support')));
  assert.ok(requetes.some(q=>q.sql.includes('account_notifications')));
});
