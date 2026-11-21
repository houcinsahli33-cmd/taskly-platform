'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V6: both client and artisan use the same faithful mobile/desktop style',()=>{
  for(const role of ['client','artisan']){
    const html=read(`client/private/${role}/messagerie.html`);
    assert.match(html,/taskly-call-maquette-v5\.css/); // rollback and historical test compatibility
    assert.match(html,/taskly-call-maquette-v6\.css/);
    assert.match(html,/taskly-call-livekit\.js/);
    assert.match(html,/taskly-call-ui\.js/);
    assert.match(html,/taskly-call-premium\.js/);
  }
});
test('V6: all real controls retain their data-tc identity; no fake sharing',()=>{
  const css=read('client/public/css/taskly-call-maquette-v6.css');
  const js=read('client/public/js/taskly-call-premium.js');
  for(const key of ['accept','reject','end','mic','camera','sound']){
    assert.match(css,new RegExp(`data-tc=["']?${key}`));
  }
  assert.match(css,/\[data-tc=remote\]/);
  assert.match(css,/\[data-tc=local\]/);
  assert.match(js,/originalShow\.apply\(this, args\)/);
  assert.match(js,/taskly-call-v5', 'taskly-call-v6/);
  assert.doesNotMatch(css,/Chiffré de bout en bout/);
  assert.doesNotMatch(js,/Ajouter un participant|Partager l'écran/);
});
test('V6: top-level dialog and global incoming calls still supported',()=>{
  const js=read('client/public/js/taskly-call-premium.js');
  const notification=read('client/public/js/taskly-call-notifications.js');
  assert.match(js,/target\.adoptNode\(dialog\)/);
  assert.match(js,/document\.adoptNode\(dialog\)/);
  assert.match(js,/data-taskly-call-v6/);
  assert.match(js,/taskly-call-maquette-v6\.css/);
  assert.match(notification,/taskly:open-call/);
  assert.match(notification,/action: 'reject'/);
});
test('V6: phone viewport and desktop window states are included',()=>{
  const css=read('client/public/css/taskly-call-maquette-v6.css');
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/100dvh/);
  assert.match(css,/data-premium-stage=incoming/);
  assert.match(css,/data-premium-stage=connecting/);
  assert.match(css,/data-premium-stage=connected/);
  assert.match(css,/\.taskly-global-call:not\(\[hidden\]\)/);
});
