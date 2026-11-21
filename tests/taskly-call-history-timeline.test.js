'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {merge,presentation}=require('../client/public/js/taskly-call-history');
test('Historique dans messagerie : appels entre les messages en ordre chronologique',()=>{
 const messages=[{id:2,created_at:'2026-11-21T15:00:00Z',contenu:'Deux'}, {id:1,created_at:'2026-11-21T12:00:00Z',contenu:'Un'}];
 const appels=[{id:'abc',callerRole:'client',mode:'audio',status:'completed',startedAt:'2026-11-21T13:00:00Z',durationSeconds:123}];
 assert.deepEqual(merge(messages,appels).map(x=>x.kind+':'+(x.item.id||'')),['message:1','call:abc','message:2']);
});
test('Historique dans messagerie : affichage entrant/sortant et durée',()=>{
 const c={callerRole:'client',mode:'video',status:'completed',durationSeconds:185};
 assert.equal(presentation(c,'client').title,'Appel vidéo sortant');
 assert.equal(presentation(c,'artisan').title,'Appel vidéo entrant');
 assert.equal(presentation(c,'artisan').state,'Terminé · 3 min 05 s');
});
test('Historique dans messagerie : manqué côté destinataire, sans réponse côté appelant',()=>{
 const c={callerRole:'artisan',mode:'audio',status:'missed'};
 assert.equal(presentation(c,'client').state,'Manqué');
 assert.equal(presentation(c,'artisan').state,'Sans réponse');
});
test('Historique dans messagerie : données inattendues et champs injectés exclus',()=>{
 const calls=[{callerRole:'admin',mode:'video',status:'missed',startedAt:'2026-11-21T13:00:00Z'},
 {callerRole:'client',mode:'javascript:bad',status:'missed',startedAt:'2026-11-21T13:00:00Z'},
 {callerRole:'client',mode:'audio',status:'fake',startedAt:'2026-11-21T13:00:00Z'},
 {callerRole:'client',mode:'audio',status:'completed',startedAt:'BAD'}];
 assert.equal(merge([],calls).length,0);
});
test('Historique intégré dans les deux messageries avec présentation compacte, pas de panneau flottant',()=>{
 for(const role of ['client','artisan']){
  const html=read('client/private/'+role+'/messagerie.html');
  assert.match(html,/taskly-call-history\.js\?v=3/);
  assert.match(html,/taskly-call-history\.css\?v=3/);
 }
 const js=read('client/public/js/taskly-chat-workspace.js');
 assert.match(js,/cw-call-event/);
 assert.match(js,/renderMessages\(lastMessages\)/);
 assert.match(js,/refreshCallHistory\(id,my\)/);
 assert.match(js,/cw-messages/);
 const css=read('client/public/css/taskly-call-history.css');
 assert.doesNotMatch(css,/\.cw-grid\s*\{/);
 assert.doesNotMatch(css,/position\s*:\s*absolute/);
});
test('Historique : route requiert participant et variable Vercel',()=>{
 const ctrl=read('server/controllers/chatController.js');
 const route=read('server/routes/demandeRoutes.js');
 assert.match(ctrl,/async function historiqueAppels/);
 assert.match(ctrl,/verifierParticipant\(req, res\)/);
 assert.match(route,/TASKLY_CHAT_CALL_HISTORY_ENABLED/);
 assert.match(route,/verifierConnexion/);
});

test('Historique : appels alignes comme les messages, pas centres',()=>{
 const js=read('client/public/js/taskly-chat-workspace.js');
 assert.match(js,/cw-message-line cw-call-line/);
 assert.match(js,/m\.callerRole===role/);
 assert.match(js,/cw-call-line'\+\(ownCall\?' mine'/);
 assert.match(js,/cw-message-avatar/);
 assert.doesNotMatch(js,/const line=el\('div',null,'cw-call-event'\)/);
 const css=read('client/public/css/taskly-call-history.css');
 assert.match(css,/\.cw-call-line\.mine \.cw-call-event/);
 assert.match(css,/\.cw-call-line \.cw-call-event/);
 assert.doesNotMatch(css,/align-self\s*:\s*center/);
 assert.doesNotMatch(css,/margin\s*:\s*9px auto/);
});
