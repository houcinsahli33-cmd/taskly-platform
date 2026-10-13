'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('historique support: acces seulement par la session authentifiee',()=>{
 const r=read('server/routes/contactRoutes.js');
 const m=read('server/models/contactModel.js');
 const c=read('server/controllers/contactController.js');
 assert.match(r,/router\.get\('\/mes-messages',require\('\.\.\/middleware\/authMiddleware'\)\.verifierConnexion/);
 assert.match(m,/WHERE user_id=\? AND contexte='public' ORDER BY created_at DESC, id DESC LIMIT \? OFFSET \?/);
 assert.match(c,/user\.id, limit \+ 1/);
 assert.match(c,/\['client','artisan'\]\.includes\(user\.role\)/);
 assert.doesNotMatch(c,/mesMessagesSupport\([\s\S]*?req\.query\.email/);
});
test('messages: rattachement au compte authentifie, formulaire public conserve',()=>{
 const m=read('server/models/contactModel.js');
 const c=read('server/controllers/contactController.js');
 assert.match(m,/INSERT INTO contacts_support \(nom,email,sujet,message,user_id,contexte\)/);
 assert.match(c,/identite\.id/);
 assert.match(c,/contactModel\.creerMessageContact\(nom, email, sujet, message\)/);
 assert.match(read('server/routes/contactRoutes.js'),/router\.get\("\/suivi"/);
});
for(const role of ['client','artisan'])test(`support ${role}: petite carte historique accessible et suivi precedent maintenu`,()=>{
 const h=read(`client/private/${role}/support.html`);
 assert.match(h,/data-support-history-toggle/);
 assert.match(h,/data-support-history-list/);
 assert.match(h,/aria-expanded="false"/);
 assert.match(h,/\/js\/taskly-support-history\.js/);
 assert.match(h,/\/css\/taskly-support-history\.css/);
 assert.match(h,/id="follow-form"/);
 assert.match(h,/id="contact-form"/);
});
test('UI: les informations sont toujours du texte, jamais du HTML non nettoye',()=>{
 const js=read('client/public/js/taskly-support-history.js');
 assert.match(js,/subject\.textContent/);
 assert.match(js,/body\.textContent/);
 assert.doesNotMatch(js,/innerHTML/);
 assert.match(js,/page=\$\{page\}/);
});
