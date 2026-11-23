'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Deux vues admin conservees dans le meme espace et accessibles',()=>{
 const s=read('client/private/admin/taskly-mail.html');
 assert.match(s,/id="tmv3-tab-support"/);assert.match(s,/id="tmv3-tab-mailboxes"/);
 assert.match(s,/id="professional-mail-pilot"/);assert.match(s,/id="mail-pilot-content"/);
 assert.match(s,/id="taskly-mail-v3-support"/);
 assert.match(s,/taskly-mail-v3-admin-design\.js/);
});
test('Messages rendus comme texte, aucun HTML injecte',()=>{
 const s=read('client/public/js/taskly-mail-v3-admin-design.js');
 assert.match(s,/\.textContent=/);assert.doesNotMatch(s,/innerHTML\s*=/);
});
test('Actions administrateur limitees aux routes existantes',()=>{
 const s=read('client/public/js/taskly-mail-v3-admin-design.js');
 assert.match(s,/\/support\/threads/);assert.match(s,/\/replies/);
 assert.doesNotMatch(s,/\/archive|\/close|\/delete|\/create-mailbox/);
});
test('Montage utilisateur Taskly Mail V3 conserve',()=>{
 const s=read('client/public/js/taskly-mail-v3-support.js');
 assert.match(s,/if\(host\.dataset\.mode==='admin' && window\.TasklyMailV3AdminUI\)return/);
 assert.match(s,/support@taskly\.dz/);
});
