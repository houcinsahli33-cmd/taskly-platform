'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const pages=['artisans.html','artisan-profile.html','service.html'];
test('les trois accès à une demande utilisent exactement le même formulaire',()=>{
 const dialogs=pages.map(name=>read('client/public/'+name).match(/<dialog id="request-modal"[\s\S]*?<\/dialog>/)[0]);
 assert.equal(new Set(dialogs).size,1);
 for(const page of pages){
  const html=read('client/public/'+page);
  assert.match(html,/taskly-request-wizard\.css/);
  assert.match(html,/taskly-request-wizard\.js/);
  assert.match(html,/data-rw-panel="0"/);assert.match(html,/data-rw-panel="1"/);assert.match(html,/data-rw-panel="2"/);
  for(const id of ['request-message','request-address','request-date','rw-submit','rw-success'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 }
});
test('le parcours conserve le contrôle de date et le point d’entrée authentifié existant',()=>{
 const wizard=read('client/public/js/taskly-request-wizard.js');
 assert.match(wizard,/tasklyRequestDateValide\(\)/);
 assert.match(wizard,/if\(busy\|\|step!==2\)return/);
 assert.match(wizard,/requeteAPI\('\/api\/demandes'/);
 assert.match(read('server/routes/demandeRoutes.js'),/router\.post\("\/", verifierConnexion, verifierClient, demandeController\.creerDemande\)/);
});
