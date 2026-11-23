'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('V12: admin inbox does not stay blank if API bootstrap fails',()=>{
 const js=load('client/public/js/taskly-admin-mail-v10.js');
 assert.match(js,/Connexion au service Taskly Mail indisponible/);
 assert.match(js,/root\.replaceChildren\(notice\)/);
 assert.match(js,/const tab=document\.getElementById\('tmv3-tab-admin-mail'\)/);
 assert.match(js,/typeof window\.requeteAPI==='function'/);
});
test('V12: existing feature flags, admin verification, and mailbox ownership remain enforced',()=>{
 const api=load('server/routes/tasklyAdminMailboxV10Routes.js');
 assert.match(api,/TASKLY_ADMIN_MAIL_V10_ENABLED==='true'/);
 assert.match(api,/TASKLY_MAIL_INTERNAL_ENABLED==='true'/);
 assert.match(api,/TASKLY_MAIL_FOLDERS_ENABLED==='true'/);
 assert.match(api,/adminVerified===true && req\.tasklyAdminContext===true/);
 assert.match(api,/m\.user_id/);
});
test('V12: admin UI cache version updated and no change to call UX',()=>{
 const html=load('client/private/admin/taskly-mail.html');
 assert.match(html,/taskly-admin-mail-v10\.js\?v=14/);
 assert.match(html,/taskly-mail-admin-validated-v6\.js/);
});
