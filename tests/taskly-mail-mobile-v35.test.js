'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'client/public/css/taskly-mail-mobile-v35.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'client/public/js/taskly-mail-mobile-v35.js'), 'utf8');

test('Mail V3.5: both workspaces include only scoped responsive assets', () => {
  for (const role of ['client', 'artisan']) {
    const html = fs.readFileSync(path.join(root,'client/private',role,'taskly-mail.html'), 'utf8');
    assert.match(html, /taskly-mail-mobile-v35\.css\?v=/);
    assert.match(html, /taskly-mail-mobile-v35\.js\?v=/);
    assert.match(html, /taskly-mail-compose-v33\.css/);
    assert.match(html, /<aside class="sidebar">/);
    assert.match(html, /data-workspace-page="taskly-mail"/);
  }
});

test('Mail V3.5: drawer is limited to mobile mail pages, not the entire site', () => {
  assert.match(js, /document\.body\.dataset\.workspacePage !== 'taskly-mail'/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /body\[data-workspace-page="taskly-mail"\]/);
  assert.match(js, /matchMedia\('\(max-width: 767px\)'\)/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /sidebar\.inert/);
  assert.match(js, /event\.key === 'Escape'/);
});

test('Mail V3.5: mobile folder buttons remain accessible and layout has no horizontal carousel overflow', () => {
  assert.match(css, /grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css, /clip-path:inset\(50%\)/);
  assert.match(css, /\.tm-compose-actions/);
  assert.match(css, /\.tm-compose-editor textarea/);
  assert.match(css, /\.tm-mail-content\.tm-reading-open/);
});

test('Mail V3.5: no server/security/mail-send changes', () => {
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|eval\(/);
  assert.match(js, /sidebar\.addEventListener\('click'/);
  assert.match(js, /closeButton\.focus\(\)/);
});
