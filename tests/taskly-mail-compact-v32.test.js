"use strict";
// Test de périmètre visuel : la V3.2 ne change aucune route d'envoi ou de sécurité.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(base, p), 'utf8');
const css = read('client/public/css/taskly-mail-compact-v32.css');

test('V3.2 : CSS chargé dans les deux espaces Taskly Mail seulement', () => {
  for (const role of ['client', 'artisan']) {
    const html = read(`client/private/${role}/taskly-mail.html`);
    assert.equal((html.match(/taskly-mail-compact-v32\.css\?v=20261121-1/g) || []).length, 1);
    assert.match(html, /professional-mailbox\.css\?v=104/);
    assert.match(html, /professional-mail-folders\.js\?v=104/);
  }
});
test('V3.2 : tous les styles sont limités à la page Taskly Mail', () => {
  assert.doesNotMatch(css, /(^|\n)\s*(?:#site-header|\.sidebar|\.dashboard-shell|\.side-nav)\s*\{/);
  assert.match(css, /body\[data-workspace-page="taskly-mail"\]/);
  assert.match(css, /@container taskly-mail \(max-width:950px\)/);
  assert.match(css, /@container taskly-mail \(max-width:700px\)/);
});
test('V3.2 : panneaux compacts et fenêtre de lecture consultable', () => {
  assert.match(css, /height:clamp\(365px,51vh,495px\)/);
  assert.match(css, /\.tm-reader-panel\{[\s\S]*?overflow-y:auto/);
  assert.match(css, /\.tm-list-panel\{[\s\S]*?overflow-y:auto/);
});
test('V3.2 : illustration locale sans script ni dépendance externe', () => {
  const svg = read('client/public/images/taskly-mail-empty-compact.svg');
  assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /<script|foreignObject|(?:href|xlink:href)=["\']https?:\/\//i);
  assert.match(css, /\/images\/taskly-mail-empty-compact\.svg/);
});
