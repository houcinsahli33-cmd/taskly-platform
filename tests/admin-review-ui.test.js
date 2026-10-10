const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

// Tests du rendu statique sans connexion à la base ni dépendances supplémentaires.
function preparerVue() {
  const elements=new Map();
  for(const id of ['admin-verification-list','admin-verification-summary','admin-verification-search','admin-verification-filter']) {
    elements.set(id,{innerHTML:'',value:id==='admin-verification-filter'?'tous':''});
  }
  const echapperHTML=valeur=>String(valeur??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const contexte=vm.createContext({
    document:{getElementById:id=>elements.get(id),addEventListener:()=>{}},
    normaliserTexte:valeur=>String(valeur||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),
    echapperHTML,
    nomComplet:objet=>[objet.prenom,objet.nom].join(' '),
    formatDateHeure:()=> '10 octobre 2026',
  });
  const chemin=path.join(__dirname,'../client/public/js/admin-verification.js');
  vm.runInContext(fs.readFileSync(chemin,'utf8'),contexte);
  vm.runInContext(`artisansVerification=[
    {id:1,prenom:'Nadia',nom:'Benali',email:'nadia@test.local',ville:'Oran',service_nom:'Plomberie',verification_statut:'en_attente',documents_count:1},
    {id:2,prenom:'Alice',nom:'Durand',email:'alice@test.local',ville:'Paris',service_nom:'Electricité',verification_statut:'approuve',documents_count:2},
    {id:3,prenom:'Eve',nom:'<img src=x onerror=alert(1)>',email:'eve@test.local',ville:'Lyon',service_nom:'Menuiserie',verification_statut:'refuse',documents_count:0}];`,contexte);
  return {contexte,elements};
}

test('filtre des dossiers par statut et recherche sans altérer le tableau',()=>{
  const {contexte,elements}=preparerVue();
  elements.get('admin-verification-filter').value='en_attente';
  vm.runInContext('afficherListeVerification()',contexte);
  const liste=elements.get('admin-verification-list').innerHTML;
  assert.match(liste,/Nadia Benali/);
  assert.doesNotMatch(liste,/Alice Durand/);
  assert.match(elements.get('admin-verification-summary').innerHTML,/1 affiché\(s\)/);
  elements.get('admin-verification-filter').value='tous';
  elements.get('admin-verification-search').value='electricite';
  vm.runInContext('afficherListeVerification()',contexte);
  assert.match(elements.get('admin-verification-list').innerHTML,/Alice Durand/);
  assert.doesNotMatch(elements.get('admin-verification-list').innerHTML,/Nadia Benali/);
});

test('échappe les champs de dossier, les motifs et les noms des admins',()=>{
  const {contexte,elements}=preparerVue();
  vm.runInContext('afficherListeVerification()',contexte);
  const liste=elements.get('admin-verification-list').innerHTML;
  assert.ok(!liste.includes('<img src=x'));
  assert.ok(liste.includes('&lt;img'));
  const ligne=vm.runInContext(`ligneHistorique({ancien_statut:'en_attente',nouveau_statut:'refuse',created_at:'2026-10-10',admin_prenom:'<script>',admin_nom:'Admin',commentaire:'<b>motif</b>'})`,contexte);
  assert.ok(!ligne.includes('<script>'));
  assert.ok(!ligne.includes('<b>motif</b>'));
  assert.match(ligne,/Bloqué \/ refusé/);
});

test('API admin : les pièces, le support et les décisions sont liés au bon dossier',async()=>{
  const routes=new Map();
  const router={
    use:()=>{},
    get:(route,handler)=>routes.set('GET '+route,handler),
    put:(route,handler)=>routes.set('PUT '+route,handler),
    post:(route,...handlers)=>routes.set('POST '+route,handlers.at(-1))
  };
  const requetes=[];
  const db={query:async(sql,params)=>{
    requetes.push({sql,params});
    if(sql.includes('FROM artisan_documents'))return [[{id:1,type_document:'diplome'}]];
    if(sql.includes('FROM contacts_support'))return [[{id:22,message:'Activation en attente'}]];
    if(sql.includes('FROM account_notifications'))return [[{id:31,statut:'sent'}]];
    if(sql.includes('FROM verification_audit'))return [[{id:44,ancien_statut:'en_attente',nouveau_statut:'approuve',admin_nom:'Admin'}]];
    throw Error('Requête non prévue');
  }};
  const module={exports:{}};
  const fichier=fs.readFileSync(path.join(__dirname,'../server/routes/adminVerificationRoutes.js'),'utf8');
  vm.runInNewContext(fichier,{
    module, exports:module.exports,console,process,Buffer,
    require:nom=>({
      express:{Router:()=>router},
      '../config/db':{promise:()=>db},
      '../middleware/authMiddleware':{verifierConnexion:()=>{},verifierAdmin:()=>{}},
      '../middleware/documentUpload':{dossier:'.'},
      '../middleware/securityMiddleware':{limiter:()=>()=>{}}
    })[nom] || require(nom)
  });
  let statut=200,corps,cache;
  const reponse={
    set:(cle,valeur)=>{if(cle==='Cache-Control')cache=valeur;return reponse;},
    json:valeur=>{corps=valeur;return reponse;},
    status:code=>{statut=code;return reponse;}
  };
  await routes.get('GET /artisans/:id/documents')({params:{id:'7'}},reponse);
  assert.equal(statut,200);
  assert.equal(cache,'no-store');
  assert.equal(corps.historique[0].nouveau_statut,'approuve');
  assert.equal(corps.support[0].id,22);
  assert.equal(requetes.length,4);
  for (const requete of requetes) assert.deepEqual(Array.from(requete.params),['7']);
});
