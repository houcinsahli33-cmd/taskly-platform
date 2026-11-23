'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const css=read('client/public/css/taskly-mail-compose-v33.css'),js=read('client/public/js/professional-mail-folders.js');
test('V3.3 : style du composeur limité au seul espace Taskly Mail',()=>{
  assert.match(css,/body\[data-workspace-page="taskly-mail"\] \.tm-app \.tm-premium-v2/);
  assert.doesNotMatch(css,/(^|\n)\s*(?:#site-header|\.sidebar|\.dashboard-shell|\.side-nav)\s*\{/);
});
test('V3.3 : feuille de style chargée dans les deux espaces uniquement',()=>{
  for(const role of ['client','artisan']){
    const html=read(`client/private/${role}/taskly-mail.html`);
    assert.equal((html.match(/taskly-mail-compose-v33\.css\?v=20261121-2/g)||[]).length,1);
    assert.match(html,/professional-mail-folders\.js\?v=104-33/);
    assert.match(html,/taskly-mail-compact-v32\.css\?v=20261121-1/);
  }
});
test('V3.3 : boîte de rédaction réelle, destinataire unique, envoi et brouillon préservés',()=>{
  for(const part of ['tm-compose-recipient-row','tm-compose-control','tm-compose-file-tools','tm-compose-footer','tm-compose-more'])assert.ok(js.includes(part));
  assert.match(js,/request\('\/send','POST'/);
  assert.match(js,/request\('\/draft','PUT'/);
  assert.match(js,/request\('\/draft','DELETE'/);
  assert.match(js,/attach\.disabled=true/);
  assert.match(js,/b\.disabled=true/);
  assert.ok(js.includes(String.raw`/^[^@]+@[a-z0-9-]+\.taskly\.(?:test|dz)$/i.test(v.to)`));
});
test('V3.3 : envoi sans modification du backend ni HTML injecté',()=>{
  assert.doesNotMatch(js,/\.innerHTML\s*=/);
  assert.match(js,/document\.createTextNode/);
  assert.match(css,/\.tm-compose-editor textarea/);
  assert.match(css,/@container taskly-mail \(max-width:650px\)/);
});
