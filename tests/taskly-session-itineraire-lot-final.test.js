'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const text=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('4 heures actives et cookies administrateur / public isolés',()=>{
 assert.match(text('server/config/sessionConfig.js'),/maxAge:4\*60\*60\*1000/);
 assert.match(text('server/config/sessionConfig.js'),/taskly\.admin\.sid/);
 assert.match(text('server/app.js'),/const sessionAdmin/);
 assert.match(text('client/public/js/api.js'),/X-Taskly-Admin/);
});
test('le message session expirée et le suivi durable sont présents',()=>{
 assert.match(text('server/services/sessionActivity.js'),/SESSION_EXPIREE/);
 assert.match(text('server/services/sessionExpiryNotifier.js'),/session_hash/);
 assert.match(text('server/services/sessionExpiryNotifier.js'),/notified_at/);
 assert.match(text('database/migration_sessions_expirees.sql'),/CREATE TABLE IF NOT EXISTS/);
 assert.match(text('server/app.js'),/CRON_SECRET/);
 assert.match(text('vercel.json'),/expire-sessions/);
});
test('liste artisan : adresse et téléphone privés avant acceptation',()=>{
 const m=text('server/models/demandeModel.js');
 assert.match(m,/CASE WHEN demandes\.statut IN/);
 assert.match(m,/ELSE NULL END AS client_telephone/);
 assert.match(m,/ELSE NULL END AS adresse/);
 const js=text('client/public/js/artisan-dashboard.js');
 assert.match(js,/Coordonnées après acceptation/);
});
test('l itinéraire intégré est réservé à la demande acceptée et propose un secours',()=>{
 assert.match(text('server/routes/demandeRoutes.js'),/itineraire\/config.*verifierConnexion,verifierArtisan/);
 const js=text('client/public/js/artisan-dashboard.js');
 assert.match(js,/getCurrentPosition/);
 assert.match(js,/maps\/embed\/v1\/directions/);
 assert.match(js,/autorisee && adresse/);
 assert.match(js,/maps\/dir/);
});
test('les accès admin publics restent sans lien d espace admin',()=>{
 assert.match(text('client/public/js/auth.js'),/if \(role === "admin"\) return "\/index\.html"/);
});
