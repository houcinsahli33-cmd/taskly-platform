'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('Presence: session authentifiee, CSRF, opt-in et limitation avant enregistrement',()=>{
 const routes=read('server/routes/demandeRoutes.js');
 const controller=read('server/controllers/chatController.js');
 assert.match(routes,/router\.post\('\/chat\/presence',verifierConnexion,verifierCsrf,limiter/);
 assert.match(controller,/TASKLY_CHAT_PRESENCE_ENABLED/);
 assert.match(controller,/req\.session\?\.utilisateur/);
 assert.match(controller,/chatModel\.enregistrerPresence\(Number\(user\.id\)\)/);
});
test('Presence: un statut vert est issu de TiDB recent pour chaque contact autorise, pas du texte arbitraire',()=>{
 const m=read('server/models/chatModel.js');
 assert.match(m,/LEFT JOIN taskly_chat_presence tp ON tp\.user_id=u\.id/);
 assert.match(m,/INTERVAL 120 SECOND/);
 assert.match(m,/AS en_ligne/);
 assert.match(m,/INSERT INTO taskly_chat_presence/);
 assert.match(m,/ON DUPLICATE KEY UPDATE/);
});
test('Presence: point superpose au bord de la photo, seulement si API dit en ligne',()=>{
 const js=read('client/public/js/taskly-chat-workspace.js');
 const css=read('client/public/css/taskly-chat-workspace.css');
 assert.match(js,/row\.en_ligne/);
 assert.match(js,/setPresence\(\$\('cw-person-avatar'\),found\?\.en_ligne\)/);
 assert.match(js,/setPresence\(\$\('cw-info-avatar'\),found\?\.en_ligne\)/);
 assert.match(js,/if\(online!==true && Number\(online\)!==1\)return null/);
 assert.match(css,/\.cw-presence-dot[\s\S]*?right:-2px;bottom:-2px/);
 assert.match(css,/border:2px solid #fff/);
});
test('Appel entrant: ouvre la fenetre officielle plutot qu une 2e boite',()=>{
 const n=read('client/public/js/taskly-call-notifications.js');
 assert.match(n,/TasklyCallHost\?\.open\?\.\(role, call\.demandeId, 'receive'\)/);
 assert.match(n,/panel\.hidden = true;[\s\S]*?stopRing\(\);[\s\S]*?return;/);
 assert.doesNotMatch(n,/Activer la sonnerie/);
});
test('Video: ni toile grise ni bandes sombre en plein ecran; capture du flux conservee',()=>{
 const float=read('client/public/css/taskly-call-floating.css');
 const video=read('client/public/css/taskly-call-maquette-v8.css');
 assert.match(float,/\.taskly-floating-call-frame[^\n]*background:#ffffff;/);
 assert.match(float,/\.taskly-call-dialog::backdrop \{background:transparent/);
 assert.match(video,/\.tc-v8-video \{max-width:100%!important;margin:0!important/);
 assert.match(video,/\[data-tc='remote'\] \{object-fit:cover/);
});
test('Navigation: aucun bouton retour au site dans la messagerie',()=>{
 const js=read('client/public/js/taskly-chat-workspace.js');
 assert.doesNotMatch(js,/back\.className='cw-return-site'/);
 assert.doesNotMatch(js,/heading\.prepend\(back\)/);
});
test('Presence: migration isolee et explicitement requise, aucune activation anticipee',()=>{
 const sql=read('database/migration_taskly_chat_presence.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS taskly_chat_presence/);
 assert.match(sql,/FOREIGN KEY \(user_id\) REFERENCES users\(id\)/);
 assert.match(read('server/models/chatModel.js'),/presenceActive = \(\) => typeof process !== 'undefined'/);
});
test('Presence: signal independant des appels LiveKit',()=>{
 const chat=read('client/public/js/taskly-chat-notifications.js');
 const calls=read('client/public/js/taskly-call-notifications.js');
 const client=read('server/routes/clientWorkspaceNavigation.js');
 const artisan=read('server/routes/artisanWorkspaceNavigation.js');

 assert.match(chat,/\/api\/demandes\/chat\/presence/);
 assert.match(chat,/setInterval\(pulsePresence,60000\)/);
 assert.match(chat,/visibilitychange/);
 assert.doesNotMatch(calls,/\/api\/demandes\/chat\/presence/);
 assert.match(client,/taskly-chat-notifications\.js/);
 assert.match(artisan,/taskly-chat-notifications\.js/);
});
