'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const text = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const shell = text('client/public/js/taskly-call-host-shell.js');
const owner = text('client/public/js/taskly-call-floating.js');
const css = text('client/public/css/taskly-call-floating.css');

test('Window: native fullscreen plus viewport fallback, no arbitrary 840x660 cap', () => {
  assert.match(shell, /host\.requestFullscreen\?\.\(\)/);
  assert.match(shell, /document\.exitFullscreen\?\.\(\)/);
  assert.match(shell, /document\.addEventListener\('fullscreenchange'/);
  assert.match(css, /\.taskly-floating-host\[data-call-window-state=max\],[\s\S]*?:fullscreen/);
  assert.match(css, /width:100vw!important;height:100vh!important;height:100dvh!important/);
  assert.doesNotMatch(css, /width:min\(840px/);
  assert.doesNotMatch(shell, /event\.data\.mode === 'video' && state === 'normal'\) setState\('max'\)/);
});
test('Window: restoring size keeps previous dimensions, minimizing does not hang up', () => {
  assert.match(shell, /normalBounds = \{left:rect\.left, top:rect\.top, width:rect\.width, height:rect\.height\}/);
  assert.match(shell, /host\.style\.width = Math\.round\(normalBounds\.width\)/);
  assert.match(shell, /setState\(state === 'min' \? 'restore' : 'min'\)/);
  assert.match(shell, /if \(event\.data\.action === 'max'\) toggleFullscreen\(\)/);
  assert.match(shell, /send\('close'\)/);
});
test('Presence: honest green dot only when the call is connected', () => {
  assert.match(owner, /presence\.className = 'tc-floating-presence'/);
  assert.match(owner, /dot\.className = 'tc-floating-presence-dot'/);
  assert.match(owner, /label\.textContent = 'En ligne'/);
  assert.match(css, /\.tc-floating-presence \{\s*display:none!important/);
  assert.match(css, /\[data-premium-stage=connected\] \.tc-floating-presence \{display:flex!important/);
  assert.doesNotMatch(shell, /innerHTML\s*=\s*[^;]*interlocuteur/);
});
test('Approved green mockup: vector controls, compact layout and video preserved', () => {
  for (const key of ['mic','sound','chat','camera','max','end']) {
    assert.ok(owner.includes(`buttons.${key}.addEventListener`));
  }
  assert.match(owner, /const icons = Object\.freeze/);
  assert.match(owner, /pictogram\.innerHTML='<svg/);
  assert.match(css, /radial-gradient\(ellipse at 50% 30%,#0a7155/);
  assert.match(css, /\[data-mode=video\]\[data-premium-stage=connected\] \.tc-videos/);
  assert.doesNotMatch(css, /\.sidebar\s*\{|#site-header\s*\{/);
});

// Validate the runtime postMessage boundary without starting a real call.
test('Runtime: shell ignores forged window commands from other frames', () => {
  const handlers = {};
  const head = {append() {}};
  const doc = {
    body:{dataset:{tasklyClientShell:'1'},append() {}},
    head,
    querySelector:()=>({}),
    createElement:()=>({dataset:{},setAttribute() {}}),
    addEventListener:(type,cb)=>{handlers['doc:'+type]=cb;},
  };
  const sandbox={
    window:{addEventListener:(type,cb)=>{handlers[type]=cb;},innerWidth:1200,innerHeight:800},
    document:doc,location:{origin:'https://taskly.example'},
    Number,Object,Math,URL,console,setTimeout,clearTimeout,
    innerWidth:1200,innerHeight:800
  };
  vm.runInNewContext(shell, sandbox);
  assert.equal(typeof sandbox.window.TasklyCallHost.open,'function');
  handlers.message({origin:'https://other.example',source:{},data:{type:'taskly:call-host-action',action:'max'}});
  assert.equal(sandbox.window.TasklyCallHost.isActive(),false);
});
