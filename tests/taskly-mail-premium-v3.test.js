'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const js=fs.readFileSync('client/public/js/professional-mail-folders.js','utf8');
const css=fs.readFileSync('client/public/css/professional-mailbox.css','utf8');

test('V3: les 8 vues partagent le même menu interne blanc, sans modifier le menu principal',()=>{
 for(const folder of ['inbox','sent','draft','favorites','archive','trash','settings'])assert.match(js,new RegExp(folder));
 assert.match(js,/tm-premium-v2/);assert.match(css,/TASKLY MAIL PREMIUM V3/);
 assert.match(css,/\.tm-premium-v2 \.tm-mail-nav/);
 assert.match(css,/--tm-green:#007f61/);
 for(const path of ['client/private/client/taskly-mail.html','client/private/artisan/taskly-mail.html']){
  const html=fs.readFileSync(path,'utf8');
  assert.match(html,/professional-mailbox\.css\?v=104/);
  assert.match(html,/professional-mail-folders\.js\?v=104/);
 }
});

test('V3: outils de rédaction effectifs et pièces jointes non simulées',()=>{
 assert.match(js,/tm-format-toolbar/);
 for(const label of ['Gras','Italique','Souligné','Liste à puces','Liste numérotée'])assert.ok(js.includes(label));
 assert.match(js,/attach\.disabled=true/);
 assert.match(js,/dispatchEvent\(new Event\('input'/);
 assert.match(js,/request\('\/draft','PUT'/);
 assert.match(js,/request\('\/send','POST'/);
});

test('V3: lecture textuelle sûre, liens externes non exécutables, confirmations maintenues',()=>{
 assert.match(js,/function safeBody/);
 assert.match(js,/document\.createTextNode/);
 assert.doesNotMatch(js,/\.innerHTML/);
 assert.match(js,/child\.rel='noopener noreferrer'/);
 assert.match(js,/confirmation\('Supprimer définitivement \?'/);
 assert.match(js,/prefs\.confirm_delete/);
});
