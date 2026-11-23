'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('client/private/admin/taskly-mail.html','utf8');
const js=fs.readFileSync('client/public/js/taskly-mail-admin-validated-v6.js','utf8');
test('trois onglets distincts',()=>{for(const id of ['tmv3-tab-support','tmv3-tab-mailboxes','tmv3-tab-admin-mail'])assert.ok(html.includes('id="'+id+'"'));});
test('le troisième panneau contient sa maquette même sans Javascript',()=>{for(const key of ['tmv6-mail-grid','tmv6-folder-panel','tmv6-message-panel','tmv6-read-panel','Réception','Envoyés','Brouillons','Favoris','Archives','Corbeille'])assert.ok(html.includes(key),key);});
test('aucun message simulé, scripts conservés et remplacement idempotent',()=>{assert.match(js,/root\.replaceChildren\(kpis,grid,notice\)/);assert.match(html,/taskly-mail-v3-admin-design\.js/);assert.match(html,/professional-mail-pilot\.js/);assert.doesNotMatch(html,/sahli\.hocine@client\.taskly\.dz/);});
