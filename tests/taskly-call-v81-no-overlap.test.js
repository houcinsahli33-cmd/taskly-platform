'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const css=read('client/public/css/taskly-call-maquette-v8.css');
const js=read('client/public/js/taskly-call-maquette-v8.js');
for(const role of ['client','artisan'])test('V8.1 cache-busted in '+role+' while LiveKit sources are retained',()=>{
  const page=read(`client/private/${role}/messagerie.html`);
  assert.match(page,/taskly-call-maquette-v8\.css\?v=9/);
  assert.match(page,/taskly-call-maquette-v8\.js\?v=9/);
  assert.match(page,/taskly-call-floating\.js/);
  assert.match(page,/taskly-call-livekit\.js/);
});
test('Legacy controls are hidden only after V8 successfully mounted in the call host',()=>{
  assert.match(js,/dialog\.dataset\.tasklyV8Ready='1'/);
  assert.match(css,/data-taskly-v8-ready='1'/);
  assert.match(css,/\.tc-panel > :not\(\.tc-v8-board\)/);
  assert.match(css,/display:none!important/);
  assert.match(css,/\.tc-panel::before/);
  assert.match(css,/\.tc-panel::after/);
  assert.match(css,/\.tc-panel > \.tc-v8-board/);
  assert.doesNotMatch(css,/\.sidebar\s*\{/);
});
test('V8 handles waiting, connected, reconnecting, incoming without rendering duplicate UI',()=>{
  for(const stage of ['incoming','connecting','reconnecting','connected'])assert.ok(js.includes(stage),stage);
  assert.match(js,/info\.board\.dataset\.callStage=stage/);
  assert.match(css,/\.tc-v8-board\[data-call-stage='incoming'\] \.tc-v8-actions/);
  assert.match(js,/const incoming=stage==='incoming'/);
  assert.match(js,/info\.incomingRow\.hidden=!incoming/);
});
test('Incoming accept/reject keep the real original handlers',()=>{
  assert.match(js,/dialog\.querySelector\('\[data-tc=accept\]'\)\?\.click\(\)/);
  assert.match(js,/dialog\.querySelector\('\[data-tc=reject\]'\)\?\.click\(\)/);
  assert.match(js,/instance\.finish\(/);
});
test('Green online status never appears before connected',()=>{
  assert.match(js,/const connected = dialog\.dataset\.premiumStage === 'connected'/);
  assert.match(js,/info\.presence\.hidden=!connected/);
  assert.match(css,/\.tc-v8-board\[data-call-stage='connecting'\] \.tc-v8-live-dot/);
});
test('Active video streams and private unread count continue using existing services',()=>{
  assert.match(js,/existingVideos=panel\.querySelector\('\.tc-videos'\)/);
  assert.match(js,/videoStage\.append\(existingVideos\)/);
  assert.match(js,/requeteAPI\('\/api\/demandes\/chat\/unread'\)/);
  assert.match(js,/remote\.play\(\)/);
  assert.match(js,/setScreenShareEnabled/);
});
