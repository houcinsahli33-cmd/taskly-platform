const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

// Ces tests couvrent la nouvelle liste avec pagination et filtres côté serveur.
function preparerVue() {
  const elements=new Map();
  for(const id of ['admin-verification-list','admin-verification-counts','admin-verification-search','admin-verification-status','admin-verification-pagination']) {
    elements.set(id,{
      innerHTML:'',textContent:'',value:id==='admin-verification-status'?'tous':'',
      replaceChildren(){this.innerHTML='';this.textContent='';}
    });
  }
  const fiche=[
    {id:1,prenom:'Nadia',nom:'Benali',email:'nadia@test.local',ville:'Oran',service_nom:'Plomberie',verification_statut:'en_attente',documents_count:1,statut_compte:'actif'},
    {id:2,prenom:'Alice',nom:'Durand',email:'alice@test.local',ville:'Paris',service_nom:'Électricité',verification_statut:'approuve',documents_count:2,statut_compte:'actif'},
    {id:3,prenom:'Eve',nom:'<img src=x onerror=alert(1)>',email:'eve@test.local',ville:'Lyon',service_nom:'Menuiserie',verification_statut:'refuse',documents_count:0,statut_compte:'bloque'},
  ];
  const appels=[];
  const echapperHTML=valeur=>String(valeur??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const contexte=vm.createContext({
    document:{getElementById:id=>elements.get(id),addEventListener:()=>{}},
    URLSearchParams,
    etatChargement:()=>'<p>Chargement...</p>',
    requeteAPI:async url=>{
      appels.push(url);
      const params=new URLSearchParams(url.split('?')[1]);
      const filtre=params.get('statut');
      const terme=(params.get('recherche')||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const items=fiche.filter(a=>(filtre==='tous'||filtre===a.verification_statut) &&
        `${a.prenom} ${a.nom} ${a.service_nom} ${a.ville}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(terme));
      return {artisans:items,total:items.length,page:1,pages:1,comptes:{total:3,en_attente:1,approuve:1,refuse:1}};
    },
    echapperHTML,nomComplet:objet=>[objet.prenom,objet.nom].join(' '),
    formatDateHeure:()=> '10 octobre 2026',
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../client/public/js/admin-verification.js'),'utf8'),contexte);
  return {contexte,elements,appels};
}

test('filtre des dossiers par statut et recherche via API sans altérer le tableau',async()=>{
  const {contexte,elements,appels}=preparerVue();
  elements.get('admin-verification-status').value='en_attente';
  await vm.runInContext('chargerArtisansVerification()',contexte);
  let liste=elements.get('admin-verification-list').innerHTML;
  assert.match(liste,/Nadia Benali/);
  assert.doesNotMatch(liste,/Alice Durand/);
  assert.match(elements.get('admin-verification-counts').textContent,/1 résultat\(s\)/);
  assert.match(appels.at(-1),/statut=en_attente/);
  elements.get('admin-verification-status').value='tous';
  elements.get('admin-verification-search').value='electricite';
  await vm.runInContext('chargerArtisansVerification()',contexte);
  liste=elements.get('admin-verification-list').innerHTML;
  assert.match(liste,/Alice Durand/);
  assert.doesNotMatch(liste,/Nadia Benali/);
  assert.match(appels.at(-1),/recherche=electricite/);
});

test('échappe les champs de dossier, les motifs et les noms des admins',async()=>{
  const {contexte,elements}=preparerVue();
  await vm.runInContext('chargerArtisansVerification()',contexte);
  const liste=elements.get('admin-verification-list').innerHTML;
  assert.ok(!liste.includes('<img src=x'));
  assert.ok(liste.includes('&lt;img'));
  const ligne=vm.runInContext(`ligneHistorique({ancien_statut:'en_attente',nouveau_statut:'refuse',created_at:'2026-10-10',admin_prenom:'<script>',admin_nom:'Admin',commentaire:'<b>motif</b>'})`,contexte);
  assert.ok(!ligne.includes('<script>'));
  assert.ok(!ligne.includes('<b>motif</b>'));
  assert.match(ligne,/Refusé/);
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
    if(sql.includes('SELECT id FROM artisans WHERE id='))return [[{id:7}]];
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
  assert.equal(requetes.length,5);
  for (const requete of requetes) assert.deepEqual(Array.from(requete.params),[7]);
});
