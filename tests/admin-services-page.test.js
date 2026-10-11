'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'client/private/admin/services.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'client/public/css/admin-services-page.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'client/public/js/admin-services-page.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'server/routes/adminRoutes.js'), 'utf8');
function helpers() {
  const mod = {exports:{}};
  vm.runInNewContext(js, {module:mod, console, imageServiceFallback:n=>'/images/services/'+(String(n).toLowerCase()||'default')+'.jpg'});
  return mod.exports;
}
test('Services : barre latérale identique à Signalements et seul onglet Services actif',()=>{
  const signalements=fs.readFileSync(path.join(root,'client/private/admin/reports.html'),'utf8');
  const getAside = x => x.match(/<aside class="admin-sidebar"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(getAside(html));
  const parseSidebar=aside=>aside.replace(/class="active" aria-current="page" /g,'').replace(/ class="active"/g,'');
  assert.equal(parseSidebar(getAside(html)),parseSidebar(getAside(signalements)));
  assert.match(getAside(html),/class="active" aria-current="page" data-admin-tab="services"/);
  assert.doesNotMatch(getAside(html),/class="active" aria-current="page" data-admin-tab="reports"/);
  assert.match(html,/data-workspace-page="services"/);
  assert.match(html,/id="admin-services"/);
  assert.match(html,/workspace-pro\.css/);
});
test('Services : affichage de données réelles, filtres et formulaires accessibles',()=>{
  for(const id of ['services-total','services-search','services-sort','services-grid','services-prev','services-next','services-editor-dialog','services-editor-form','services-delete-dialog'])assert.ok(html.includes(`id="${id}"`),id);
  assert.match(html,/admin-services-page\.js/);
  assert.match(js,/requeteAPI\('\/api\/services'/);
  assert.match(js,/`\/api\/admin\/services\/\$\{service\.id\}`/);
  assert.match(js,/method:service\?'PUT':'POST'/);
  assert.match(js,/method:'DELETE'/);
  assert.doesNotMatch(js,/\.innerHTML\s*=/);
  assert.match(css,/body\.admin-services-page/);
});
test('Services : recherche accentuée et tri réels par nom, artisans et demandes',()=>{
  const {filtrerEtTrier}=helpers();
  const services=[{nom:'Électricité',description:'Débouchage',total_artisans:4,total_demandes:8},{nom:'Carrelage',description:'Cuisine',total_artisans:1,total_demandes:19},{nom:'Plomberie',description:'Réparation',total_artisans:7,total_demandes:3}];
  assert.deepEqual(Array.from(filtrerEtTrier(services,'electricite','actuel'),s=>s.nom),['Électricité']);
  assert.deepEqual(Array.from(filtrerEtTrier(services,'deBOUCHage','actuel'),s=>s.nom),['Électricité']);
  assert.deepEqual(Array.from(filtrerEtTrier(services,'','az'),s=>s.nom),['Carrelage','Électricité','Plomberie']);
  assert.deepEqual(Array.from(filtrerEtTrier(services,'','za'),s=>s.nom),['Plomberie','Électricité','Carrelage']);
  assert.deepEqual(Array.from(filtrerEtTrier(services,'','artisans'),s=>s.nom),['Plomberie','Électricité','Carrelage']);
  assert.deepEqual(Array.from(filtrerEtTrier(services,'','demandes'),s=>s.nom),['Carrelage','Électricité','Plomberie']);
  assert.equal(services[0].nom,'Électricité','le catalogue source ne doit pas être trié en place');
});
test('Services : protection des photos, chemins et taille',()=>{
  const {validerPhoto,cheminImage}=helpers();
  assert.equal(validerPhoto(null),'');
  assert.equal(validerPhoto({type:'image/png',size:3000}),'');
  assert.match(validerPhoto({type:'application/pdf',size:3000}),/JPEG ou PNG/);
  assert.match(validerPhoto({type:'image/jpeg',size:3200000}),/3 Mo/);
  assert.equal(cheminImage({nom:'Test',image:'/api/media/abc123'}),'/api/media/abc123');
  assert.equal(cheminImage({nom:'Test',image:'javascript:alert(1)'}),'/images/services/test.jpg');
  assert.equal(cheminImage({nom:'Test',image:'//evil.example/a.jpg'}),'/images/services/test.jpg');
});
test('Services : réutilise les API admin protégées et refuse la suppression liée à un artisan',()=>{
  assert.match(routes,/router\.use\(verifierConnexion, verifierAdmin\)/);
  assert.match(routes,/router\.post\("\/services"/);
  assert.match(routes,/router\.put\("\/services\/:id"/);
  assert.match(routes,/router\.delete\("\/services\/:id"/);
  const controller=fs.readFileSync(path.join(root,'server/controllers/adminController.js'),'utf8');
  assert.match(controller,/FROM artisans WHERE service_id=\?/);
  assert.match(controller,/status\(409\)/);
});
