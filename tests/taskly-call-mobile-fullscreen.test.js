'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const css=read('client/public/css/taskly-call-maquette-v8.css');
const shell=read('client/public/js/taskly-call-host-shell.js');

test('Mobile full screen has separate contact and device rows, avoids the six cramped columns',()=>{
  assert.match(css,/TASKLY_CALL_RESPONSIVE_V12/);
  assert.match(css,/flex-direction:column!important/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/overflow-y:auto!important/);
  assert.match(css,/tc-v8-name[\s\S]*?white-space:normal!important/);
});
test('Fullscreen restore recenters original-size call instead of returning to left edge',()=>{
  assert.match(shell,/previous === 'max' && state === 'normal'/);
  assert.match(shell,/host\.style\.width = Math\.round\(normalBounds\.width\)/);
  assert.match(shell,/center\(\);/);
  assert.doesNotMatch(shell,/host\.style\.left = Math\.max\(6, Math\.round\(normalBounds\.left\)\)/);
});
test('Mobile assets are versioned for both accounts and persistent call host',()=>{
  for(const role of ['client','artisan']){
    const html=read(`client/private/${role}/messagerie.html`);
    assert.match(html,/taskly-call-maquette-v8\.css\?v=12/);
    assert.match(html,/taskly-call-maquette-v8\.js\?v=12/);
  }
  assert.match(read('client/public/js/taskly-call-notifications.js'),/taskly-call-host-shell\.js\?v=11/);
  assert.match(read('client/public/js/taskly-call-floating.js'),/taskly-call-host-shell\.js\?v=11/);
});
