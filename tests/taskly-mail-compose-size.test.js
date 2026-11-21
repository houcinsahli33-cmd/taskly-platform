"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('client/public/css/taskly-mail-compose-v33.css', 'utf8');

test('Compose compact: hauteur du formulaire bornée sans modifier la fenêtre Taskly', () => {
  const section = css.slice(css.indexOf('TASKLY MAIL V3.4'));
  assert.ok(section.startsWith('TASKLY MAIL V3.4'));
  assert.match(section, /@container taskly-mail \(min-width:701px\)/);
  assert.match(section, /\.tm-compose-form\s*\{[^}]*min-height:0!important;[^}]*height:clamp\(390px,51vh,465px\);[^}]*max-height:465px;/s);
  assert.doesNotMatch(section, /\.dashboard-shell\s*\{|\.sidebar\s*\{|#site-header\s*\{|\.tm-premium-v2\s*\{/);
});

test('Compose compact: seul le texte défile à l’intérieur du rédacteur', () => {
  const section = css.slice(css.indexOf('TASKLY MAIL V3.4'));
  assert.match(section, /\.tm-compose-editor textarea\s*\{[^}]*min-height:0!important;[^}]*resize:none;[^}]*overflow-y:auto;/s);
  assert.match(section, /\.tm-compose-editor \.tm-compose-body\s*\{[^}]*min-height:0!important;/s);
});

test('Compose compact: adaption étroite et présence dans les deux espaces', () => {
  assert.match(css, /@container taskly-mail \(max-width:700px\)/);
  const section = css.slice(css.indexOf('TASKLY MAIL V3.4'));
  assert.match(section, /height:clamp\(150px,24dvh,210px\)!important;/);
  for (const role of ['client', 'artisan']) {
    const html = fs.readFileSync(`client/private/${role}/taskly-mail.html`, 'utf8');
    assert.match(html, /taskly-mail-compose-v33\.css\?v=20261121-2/);
  }
});
