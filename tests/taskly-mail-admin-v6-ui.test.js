'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel),'utf8');

test('Taskly Administration : trois onglets et panneaux distincts, avec selection ARIA',()=>{
 const html=read('client/private/admin/taskly-mail.html');
 for(const [tab,panel] of [['tmv3-tab-support','tmv3-view-support'],['tmv3-tab-mailboxes','tmv3-view-mailboxes'],['tmv3-tab-admin-mail','tmv3-view-admin-mail']]){
  assert.match(html,new RegExp('id="'+tab+'"[^>]*aria-controls="'+panel+'"'));
  assert.match(html,new RegExp('id="'+panel+'"[^>]*aria-labelledby="'+tab+'"'));
 }
 assert.match(html,/taskly-mail-admin-validated-v6\.css\?v=1/);
 assert.match(html,/taskly-mail-admin-validated-v6\.js\?v=1/);
});
test('les scripts Support V3 et boites automatiques restent presents',()=>{
 const html=read('client/private/admin/taskly-mail.html');
 assert.match(html,/taskly-mail-v3-support\.js/);
 assert.match(html,/professional-mail-pilot\.js/);
 assert.match(html,/taskly-mail-v3-admin-design\.js/);
 const js=read('client/public/js/taskly-mail-v3-admin-design.js');
 assert.match(js,/\/support\/threads/);
 assert.match(js,/\/replies/);
 assert.match(js,/mail-pilot-content/);
 assert.match(js,/tabs\.length/);
});
test('aucun mail fictif ni envoi non autorise depuis interface 3',()=>{
 const js=read('client/public/js/taskly-mail-admin-validated-v6.js');
 assert.match(js,/messages=\[\]/);
 assert.match(js,/newBtn\.disabled=true/);
 assert.match(js,/send\.disabled=true/);
 assert.doesNotMatch(js,/requeteAPI\('\/api\/taskly-mail\/mailbox/);
});
