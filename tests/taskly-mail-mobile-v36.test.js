'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'client/public/js/taskly-mail-mobile-v35.js'),'utf8');
const css=fs.readFileSync(path.join(root,'client/public/css/taskly-mail-mobile-v35.css'),'utf8');
test('V3.6: Taskly header hamburger controls one drawer and suppresses original dropdown',()=>{
 assert.match(js,/bindExistingHeader/);
 assert.match(js,/\[data-menu-toggle\]/);
 assert.match(js,/stopImmediatePropagation/);
 assert.match(js,/siteHeader\.classList\.remove\('menu-open'\)/);
 assert.match(js,/headerToggle \|\| openButton/);
});
test('V3.6: site header fallback, focus return and safe scoping',()=>{
 assert.match(js,/accessibleDocuments/);
 assert.match(js,/taskly:auth-ready/);
 assert.match(js,/headerObserver/);
 assert.match(js,/tm-header-controls-drawer/);
 assert.match(css,/body\[data-workspace-page="taskly-mail"\]\.tm-header-controls-drawer/);
 assert.match(js,/sidebar\.inert/);
});
test('V3.6: only client and artisan mail assets change cache',()=>{
 for (const role of ['client','artisan']) {
  const html=fs.readFileSync(path.join(root,'client/private',role,'taskly-mail.html'),'utf8');
  assert.match(html,/taskly-mail-mobile-v35\.css\?v=20261121-2/);
  assert.match(html,/taskly-mail-mobile-v35\.js\?v=20261121-2/);
 }
});
