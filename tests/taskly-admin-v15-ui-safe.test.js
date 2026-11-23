'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('V15: only the validated header add button is rendered',()=>{
 const ui=read('client/public/js/taskly-mail-admin-validated-v6.js');
 const pilot=read('client/public/js/professional-mail-pilot.js');
 assert.match(ui,/tmv6-manual-add/);
 assert.match(ui,/taskly:open-manual-mail/);
 assert.match(pilot,/getElementById\('tmv6-manual-add'\)/);
 assert.match(pilot,/manualMailEnabled/);
 assert.doesNotMatch(pilot,/actionRow\.append\(open\)|root\.append\(actionRow\)|tmv9-manual-mail/);
 assert.match(pilot,/manual-provision/);
});
test('V15: account picker uses existing conversation list menu, not extra toolbar buttons',()=>{
 const ui=read('client/public/js/taskly-mail-v3-admin-design.js');
 assert.match(ui,/Afficher les comptes clients et artisans ou revenir aux conversations/);
 assert.match(ui,/support\/contacts\?q=/);
 assert.match(ui,/showCompose\(account\)/);
 assert.doesNotMatch(ui,/tools\.append\(initiate\)/);
 assert.doesNotMatch(ui,/filters\.append\(all,support,accounts/);
 assert.match(ui,/Conversations actives/);
});
test('V15: admin Mail shell stays mounted and reports API unavailability',()=>{
 const v10=read('client/public/js/taskly-admin-mail-v10.js');
 const nav=read('client/public/js/taskly-mail-admin-validated-v6.js');
 const html=read('client/private/admin/taskly-mail.html');
 assert.match(v10,/ensureMailPanel/);
 assert.match(v10,/taskly:admin-mail-visible/);
 assert.match(v10,/Réessayer/);
 assert.match(nav,/taskly:admin-mail-visible/);
 assert.match(html,/tmv6-mail-grid/);
 assert.match(html,/taskly-admin-mail-v10\.js\?v=14&fix=15/);
});
test('V15: no changes to the automatic creation route or private chat and LiveKit',()=>{
 const pilot=read('client/public/js/professional-mail-pilot.js');
 const mail=read('server/routes/professionalMailRoutes.js');
 assert.match(mail,/if\(autoInternal&&decision==='confirm'\)/);
 assert.match(pilot,/data\.manualMailEnabled/);
 const v10=read('server/routes/tasklyAdminMailboxV10Routes.js');
 for(const flag of ['TASKLY_ADMIN_MAIL_V10_ENABLED','TASKLY_MAIL_INTERNAL_ENABLED','TASKLY_MAIL_FOLDERS_ENABLED'])assert.ok(v10.includes(flag));
});
