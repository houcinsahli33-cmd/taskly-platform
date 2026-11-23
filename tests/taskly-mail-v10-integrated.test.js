'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('V10: pages Support sans bloc additionnel et formulaires historiques préservés',()=>{
 for(const role of ['client','artisan']){const page=read(`client/private/${role}/support.html`);assert.doesNotMatch(page,/id="taskly-mail-v3-support"/);assert.match(page,/id="contact-form"/);assert.match(page,/data-open-support-follow/);}
});
test('V10: fonctions nouvelles séparées et désactivées par défaut',()=>{
 const app=read('server/app.js'),admin=read('server/routes/tasklyAdminMailboxV10Routes.js');assert.match(app,/TASKLY_ADMIN_MAIL_V10_ENABLED === 'true'/);assert.match(admin,/verifierConnexion,verifierAdmin/);assert.match(admin,/req\.session\?\.adminVerified===true/);assert.match(admin,/req\.tasklyAdminContext===true/);assert.match(admin,/taskly_admin_mail_messages/);assert.doesNotMatch(admin,/SELECT \* FROM taskly_professional_mail_messages(?! WHERE owner_user_id)/);
});
test('V10: clients et artisans gardent leur moteur d’envoi, avec chemins spéciaux opt-in',()=>{
 const s=read('server/services/professionalMailInternal.js');assert.match(s,/TASKLY_ADMIN_MAIL_V10_ENABLED==='true'/);assert.match(s,/TASKLY_MAIL_UNIFIED_SUPPORT_ENABLED==='true'/);assert.match(s,/const result = await transaction/);assert.match(s,/WHERE owner_user_id = \?/);assert.match(s,/if \(!target \|\| target\.address !== d\.to\)/);
});
test('V10: suspension réversible et contrôles réels',()=>{
 const migration=read('database/migration_taskly_admin_mail_v10.sql');const route=read('server/routes/professionalMailRoutes.js');assert.match(migration,/suspended_at DATETIME NULL/);assert.match(route,/admin\.post\('\/:id\/access'/);assert.match(route,/\['suspend','restore'\]/);assert.match(route,/TASKLY_ADMIN_MAIL_V10_ENABLED/);assert.match(route,/req\.session\?\.adminVerified!==true/);assert.doesNotMatch(route,/DELETE FROM taskly_professional_mailboxes/);
});
test('V10: interface admin 3 colonnes, données API, pas de données fictives',()=>{
 const js=read('client/public/js/taskly-admin-mail-v10.js'),html=read('client/private/admin/taskly-mail.html');assert.match(html,/taskly-admin-mail-v10\.js\?v=1/);assert.match(js,/tmv6-mail-grid/);assert.match(js,/\/messages\?folder=/);assert.match(js,/\/send/);assert.match(js,/\/recipients\?q=/);assert.match(js,/\/draft/);assert.match(js,/textContent=/);assert.doesNotMatch(js,/innerHTML\s*=/);assert.doesNotMatch(js,/sahli\.hocine@/);
});
