'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const js=fs.readFileSync('client/public/js/professional-mail-folders.js','utf8');
const css=fs.readFileSync('client/public/css/professional-mailbox.css','utf8');
test('Taskly Mail V3.1 : chaque rubrique de paramètres est un panneau exclusif',()=>{
 assert.match(js,/function selectSettingsCategory\(id,focus=false\)/);
 assert.match(js,/panel\.hidden=!selected/);
 assert.match(js,/tab\.setAttribute\('role','tab'\)/);
 assert.match(js,/panel\.setAttribute\('role','tabpanel'\)/);
 assert.match(js,/tab\.setAttribute\('aria-controls','tm-setting-'\+id\)/);
 assert.match(js,/grid\.querySelectorAll\('\[data-preference\]'\)/);
 assert.match(css,/\.tm-settings-card\[hidden\]\{display:none!important\}/);
 for(const id of ['general','notifications','signature','security','links','display','privacy'])assert.ok(js.includes("['"+id+"'"));
});
test('Taskly Mail V3.1 : présentation responsive contenue dans le véritable espace Taskly',()=>{
 assert.match(css,/container:taskly-mail \/ inline-size/);
 assert.match(css,/@container taskly-mail \(max-width:950px\)/);
 assert.match(css,/@container taskly-mail \(max-width:700px\)/);
 assert.match(css,/@container taskly-mail \(max-width:440px\)/);
 for(const file of ['client/private/client/taskly-mail.html','client/private/artisan/taskly-mail.html']){
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/professional-mailbox\.css\?v=104/);
  assert.match(html,/professional-mail-folders\.js\?v=104/);
 }
});
