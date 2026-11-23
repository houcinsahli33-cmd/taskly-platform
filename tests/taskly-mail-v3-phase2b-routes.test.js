'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'../server');
const api=fs.readFileSync(path.join(base,'routes/tasklyMailServiceV3Routes.js'),'utf8');
const app=fs.readFileSync(path.join(base,'app.js'),'utf8');
test('V3 routes: feature flag desactive par defaut',()=>{
 assert.match(api,/TASKLY_MAIL_SERVICE_V3_ENABLED==='true'/);
 assert.match(api,/TASKLY_MAIL_INTERNAL_ENABLED==='true'/);
});
test('V3 routes: jamais de role utilisateur lu du body',()=>{
 assert.match(api,/req\.session\.utilisateur\.id/);
 assert.match(api,/verifierConnexion,verifierAdmin/);
 assert.doesNotMatch(api,/req\.body\.(?:userId|user_id|adminId|admin_id)/);
});
test('V3 routes: statut actif, boite valide et lien demande exiges',()=>{
 for(const token of ['activated_at IS NOT NULL','approved_pending_provider','proposed_address','verification_statut', 'modeClient(env)']) assert.ok(api.includes(token));
});
test('V3 routes: routes distinctes, limitation et transaction',()=>{
 assert.match(api,/user\.post\('\/support\/threads'/);
 assert.match(api,/admin\.post\('\/support\/threads\/:id\/replies'/);
 assert.match(api,/await conn\.beginTransaction\(\)/);
 assert.match(api,/await conn\.rollback\(\)/);
});
test('V3 routes: API active seulement derriere le drapeau et avant la route 404',()=>{
 assert.match(app,/TASKLY_MAIL_SERVICE_V3_ENABLED === 'true'/);
 assert.ok(app.indexOf("TASKLY_MAIL_SERVICE_V3_ENABLED === 'true'")<app.indexOf('app.use("/api/admin", adminRoutes)'));
});
