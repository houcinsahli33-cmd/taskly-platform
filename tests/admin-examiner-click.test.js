'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');

function maquetteExamen() {
  const events = new Map(), elements=new Map();
  function noeud(id) {
    if(!elements.has(id)) elements.set(id,{
      id,hidden:true,value:id==='admin-verification-status'?'tous':'',innerHTML:'',textContent:'',
      events:new Map(),addEventListener(name,fn){this.events.set(name,fn);},
      querySelector(sel){
        if(sel==='[data-close-review]' || sel==='button[data-close-review]') return {focus(){}};
        if(sel==='#admin-review-content') return contenu;
        return null;
      },
      querySelectorAll(){return [];}
    });
    return elements.get(id);
  }
  const contenu={innerHTML:'',textContent:'',removeAttribute(){},setAttribute(){},querySelector(){return {addEventListener(){}};},querySelectorAll(){return [];}};
  const handlers={};const calls=[];
  let resolver;
  const attente=new Promise(resolve=>{resolver=resolve;});
  const artisan={id:11,nom:'<script>alert(1)</script>',prenom:'Yanis',email:'test@test.com',ville:'Oran',service_nom:'Plomberie',verification_statut:'en_attente',documents_count:1};
  const code=fs.readFileSync(path.join(root,'client/public/js/admin-verification.js'),'utf8');
  const sandbox={
    URLSearchParams,Number,String,Array,Set,Math,Date,console,setTimeout,clearTimeout,
    window:{utilisateurCourant:{role:'admin'}},
    document:{
      body:{classList:{add(){},remove(){}}},getElementById:noeud,
      addEventListener(name,fn){handlers[name]=fn;}
    },
    echapperHTML:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    nomComplet: a=>`${a.prenom} ${a.nom}`,
    formatDateHeure:()=> '10 octobre 2026',
    attendreSession:async()=>true,
    requeteAPI:async url=>{
      calls.push(url);
      if(url.startsWith('/api/admin-verification/artisans?'))return {artisans:[artisan],total:1,page:1,pages:1};
      if(url.endsWith('/documents'))return attente;
      throw Error('Requête non préparée');
    },
    afficherToast:()=>{},
    etatChargement:()=>'<p>Chargement</p>'
  };
  vm.runInNewContext(code,sandbox);
  return {artisan,contenu,attente,resolve:resolver,handlers,elements,calls};
}

test('Examiner ouvre immédiatement une vraie fenêtre avant la réponse du serveur',async()=>{
  const m=maquetteExamen();
  await m.handlers.DOMContentLoaded();
  await new Promise(setImmediate);
  const liste=m.elements.get('admin-verification-list');
  assert.match(liste.innerHTML,/data-examine-artisan="11"/);
  assert.ok(!liste.innerHTML.includes('<script>'));
  liste.events.get('click')({target:{closest:()=>({dataset:{examineArtisan:'11'}})}});
  const fenetre=m.elements.get('admin-verification-details');
  assert.equal(fenetre.hidden,false);
  assert.match(fenetre.innerHTML,/role="dialog"/);
  assert.match(fenetre.innerHTML,/Chargement des pièces et de l’historique/);
  assert.match(m.calls.at(-1),/artisans\/11\/documents/);
  m.resolve({documents:[{id:14,type_document:'diplome',original_name:'preuve.pdf'}],support:[],historique:[],notifications:[]});
  await new Promise(setImmediate);
  assert.match(m.contenu.innerHTML,/preuve\.pdf/);
  assert.match(m.contenu.innerHTML,/Décision administrative/);
  assert.ok(!m.contenu.innerHTML.includes('<script>'));
});

test('les pages privées sont dans client/private et absentes du public',()=>{
  for(const nom of ['admin-login.html','admin-dashboard.html']){
    assert.equal(fs.existsSync(path.join(root,'client/private',nom)),nom==='admin-login.html');
    assert.equal(fs.existsSync(path.join(root,'client/public',nom)),false);
    assert.equal(fs.existsSync(path.join(root,'public',nom)),false);
    assert.equal(fs.existsSync(path.join(root,'private',nom)),false);
  }
  const app=fs.readFileSync(path.join(root,'server/app.js'),'utf8');
  assert.ok(app.includes('../client/private/admin-login.html'));
  assert.ok(app.includes("require('./routes/workspacePages')"));
  const pages=fs.readFileSync(path.join(root,'server/routes/workspacePages.js'),'utf8');
  assert.match(pages,/verifierConnexion/);
  assert.match(pages,/verifierAdmin/);
});
