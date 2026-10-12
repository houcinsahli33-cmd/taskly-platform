'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const page=read('client/private/admin/verification.html');
const js=read('client/public/js/admin-verification.js');
const css=read('client/public/css/admin-verification-page.css');
const routes=read('server/routes/adminVerificationRoutes.js');

test('Vérification : barre latérale exactement identique à Signalements, onglet actif adapté',()=>{
  const other=read('client/private/admin/reports.html');
  const aside=x=>x.match(/<aside class="admin-sidebar"[\s\S]*?<\/aside>/)?.[0];
  const sansActif=x=>x.replace(/class="active" aria-current="page" /g,'');
  assert.equal(sansActif(aside(page)),sansActif(aside(other)));
  assert.match(aside(page),/class="active" aria-current="page" data-admin-tab="verification"/);
  assert.match(page,/class="dashboard-page admin-users-page admin-verification-page"/);
  assert.match(css,/body\.admin-verification-page/);
});

test('Vérification : statistiques, cinq filtres, tri, tableau réel et modale présents',()=>{
  for(const id of ['verify-total','verify-pending','verify-complement','verify-reviewed',
    'admin-verification-list','admin-verification-search','admin-verification-status',
    'admin-verification-sort','admin-verification-pagination','admin-verification-details']){
    assert.ok(page.includes(`id="${id}"`),id);
  }
  assert.equal((page.match(/data-verify-filter=/g)||[]).length,5);
  assert.match(js,/requeteAPI\(`\/api\/admin-verification\/artisans\?/);
  assert.match(js,/DOSSIERS_PAR_PAGE = 8/);
  assert.match(js,/limite:String\(DOSSIERS_PAR_PAGE\)/);
  assert.match(js,/data-examine-artisan/);
  assert.match(js,/Dossier de/);
  assert.match(js,/admin-decision-form/);
  assert.doesNotMatch(page,/@taskly\.test|Données de démonstration/);
});

function chargerRoutes(){
  const routesMap=new Map(),queries=[];
  const router={use(){},get:(url,fn)=>routesMap.set('GET '+url,fn),put:(url,fn)=>routesMap.set('PUT '+url,fn),post:(url,...fn)=>routesMap.set('POST '+url,fn.at(-1))};
  const db={query:async(sql,params)=>{
    queries.push({sql,params});
    if(sql.includes('COUNT(*) AS total') && sql.includes('JOIN services'))return [[{total:21}]];
    if(sql.includes('COALESCE(SUM(a.verification_statut'))return [[{total:55,en_attente:12,a_completer:6,approuve:35,refuse:2}]];
    if(sql.includes('SELECT a.id,a.verification_statut'))return [[{id:1,nom:'Exemple',date_inscription:'2026-10-11'}]];
    return [[]];
  }};
  const sandbox={module:{exports:{}},console,process,Number,String,Array,Date,Math,Set,Buffer,
    require:name=>({express:{Router:()=>router},'../config/db':{promise:()=>db},'../middleware/authMiddleware':{verifierConnexion(){},verifierAdmin(){}},'../middleware/documentUpload':{dossier:'.'},'../middleware/securityMiddleware':{limiter:()=>()=>{}}})[name]||require(name)};
  vm.runInNewContext(routes,sandbox);
  return {routesMap,queries};
}
function response(){
  const r={statusCode:200,headers:{},set(k,v){r.headers[k]=v;return r;},status(code){r.statusCode=code;return r;},json(data){r.data=data;return r;}};
  return r;
}
test('Vérification : pagination et tri serveur validés et paramétrés',async()=>{
  const {routesMap,queries}=chargerRoutes();
  const handler=routesMap.get('GET /artisans');
  const res=response();
  await handler({query:{page:'2',limite:'8',statut:'a_completer',tri:'ancien',recherche:'Plomberie'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.data.total,21);
  const req=queries.find(x=>x.sql.includes('SELECT a.id,a.verification_statut'));
  assert.match(req.sql,/ORDER BY a\.created_at ASC,a\.id ASC LIMIT \? OFFSET \?/);
  assert.match(req.sql,/u\.created_at AS date_inscription/);
  assert.equal(req.params.at(-2),8);
  assert.equal(req.params.at(-1),8);
  assert.ok(req.params.includes('%Plomberie%'));
  assert.ok(req.params.includes('a_completer'));
  assert.equal(res.headers['Cache-Control'],'no-store');
  const bad=response();
  await handler({query:{tri:'x ASC; DROP TABLE users'}},bad);
  assert.equal(bad.statusCode,400);
  const examined=response();
  await handler({query:{statut:'examines'}},examined);
  assert.ok(queries.some(x=>x.sql.includes("IN ('approuve','refuse')")));
});

test('Vérification : seuls PDF/PNG/JPEG en prévisualisation ; téléchargements protégés',()=>{
  assert.match(routes,/router\.use\(verifierConnexion, verifierAdmin\)/);
  assert.match(routes,/SELECT id,type_document,original_name,media_type,created_at/);
  assert.match(routes,/\['application\/pdf','image\/png','image\/jpeg'\]/);
  assert.match(routes,/req\.query\?\.afficher==='1'/);
  assert.match(routes,/Content-Security-Policy/);
  assert.match(routes,/nosniff/);
  assert.match(js,/rel="noopener noreferrer"/);
});

test('Vérification : choix notification relié à la décision et conservant l’ancien comportement',()=>{
  assert.match(js,/name="notifier" checked/);
  assert.match(js,/JSON\.stringify\(\{statut,commentaire,notifier\}\)/);
  assert.match(routes,/const notifier=req\.body\?\.notifier!==false/);
  assert.match(routes,/if\(notifier\)\{/);
  assert.match(routes,/await conn\.commit\(\)/);
  assert.match(routes,/\!notifier\?'Décision enregistrée sans notification e-mail\.'/);
});

test('Vérification : décision sans notification est persistée sans créer ni envoyer un e-mail',async()=>{
  const all=[],routesMap=new Map();
  const conn={
    beginTransaction:async()=>all.push('begin'),commit:async()=>all.push('commit'),rollback:async()=>all.push('rollback'),release(){},
    query:async(sql,values=[])=>{
      all.push(sql);
      if(sql.includes('FOR UPDATE'))return [[{id:14,user_id:42,verification_statut:'en_attente',email:'artisan@example.org',prenom:'Exemple'}]];
      return [{insertId:10,affectedRows:1}];
    }
  };
  const db={getConnection:async()=>conn};
  const router={use(){},get(){},post(){},put:(url,fn)=>routesMap.set(url,fn)};
  let sent=false;
  const module={exports:{}};
  vm.runInNewContext(routes,{module,exports:module.exports,console,process,Date,Buffer,Number,Array,Set,String,
    require:name=>({express:{Router:()=>router},'../config/db':{promise:()=>db},
      '../middleware/authMiddleware':{verifierConnexion(){},verifierAdmin(){}},
      '../middleware/documentUpload':{dossier:'.'},
      '../middleware/securityMiddleware':{limiter:()=>()=>{}},
      '../services/accountNotifications':{envoyer:async()=>{sent=true;return true;}}})[name]||require(name)});
  const res=response();
  await routesMap.get('/artisans/:id/decision')({params:{id:'14'},session:{utilisateur:{id:9}},body:{statut:'a_completer',commentaire:'Merci de compléter les pièces manquantes.',notifier:false}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.data.emailEnvoye,false);
  assert.match(res.data.message,/sans notification/);
  assert.ok(all.some(sql=>sql.includes('verification_audit')));
  assert.ok(all.includes('commit'));
  assert.ok(!all.some(sql=>sql.includes('INSERT INTO account_notifications')));
  assert.equal(sent,false);
});
