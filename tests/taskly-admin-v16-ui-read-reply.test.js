'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');

test('V16: three approved tabs and dedicated responsive stylesheet are retained',()=>{
 const html=read('client/private/admin/taskly-mail.html');
 const css=read('client/public/css/taskly-mail-fidele-2026.css');
 for(const id of ['tmv3-tab-support','tmv3-tab-mailboxes','tmv3-tab-admin-mail'])assert.ok(html.includes(id),id);
 assert.match(html,/taskly-mail-fidele-2026\.css\?v=160/);
 for(const required of ['.tmv5-layout','.tmv3-mailbox-overview','.tmv6-mail-grid','.tmv16-reply-bar','@media(max-width:720px)'])assert.ok(css.includes(required),required);
});
test('V16: administrative reply uses existing verified mailbox API, not support or private-chat endpoints',()=>{
 const script=read('client/public/js/taskly-admin-mail-v10.js');
 assert.match(script,/const base='\/api\/admin\/taskly-mail-v10'/);
 assert.match(script,/q\('\/send','POST'/);
 assert.match(script,/q\('\/messages\?folder='/);
 assert.match(script,/replyInput\.maxLength=10000/);
 assert.match(script,/\.textContent=String\(text\)/);
 assert.doesNotMatch(script,/\binnerHTML\s*=/);
 assert.doesNotMatch(script,/\/api\/demandes\/.*chat/);
});
test('V16: automatic mailbox provisioning and client-artisan private messaging / LiveKit untouched in patch',()=>{
 const html=read('client/private/admin/taskly-mail.html');
 assert.match(html,/mail-pilot-content/);
 assert.match(html,/tmv3-view-admin-mail/);
 assert.match(html,/taskly-admin-mail-v10\.js\?v=14&fix=15&ui=16/);
});
