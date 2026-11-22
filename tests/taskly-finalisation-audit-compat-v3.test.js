"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');
test('V3: private attachments and privacy checks preserved',()=>{
 const ctrl=load('server/controllers/chatController.js');
 assert.match(ctrl,/piecesJointesActives: typeof process !== 'undefined'/);
 assert.match(ctrl,/signalerPresence/);
 const js=load('client/public/js/taskly-chat-workspace.js');
 assert.match(js,/cw-attach/);
});
test('V3: V9 media and V8 call maquette preserved in both spaces',()=>{
 for(const role of ['client','artisan']){
  const html=load(`client/private/${role}/messagerie.html`);
  assert.match(html,/taskly-call-livekit\.js/);
  assert.match(html,/taskly-call-maquette-v8\.js\?v=12/);
  assert.match(html,/taskly-chat-workspace\.js\?v=calls-v10/);
  assert.match(html,/taskly-call-floating\.css\?v=10/);
 }
});
test('V3: official incoming window rather than legacy activation prompt',()=>{
 const js=load('client/public/js/taskly-call-notifications.js');
 assert.match(js,/TasklyCallHost\?\.open\?\.\(role, call\.demandeId, 'receive'\)/);
 assert.doesNotMatch(js,/Activer la sonnerie/);
 assert.match(js,/taskly:persistent-call-connected/);
 assert.match(js,/taskly-call-host-shell\.js\?v=11/);
});
test('V3: session-based presence remains gated behind feature flag',()=>{
 const routes=load('server/routes/demandeRoutes.js');
 const model=load('server/models/chatModel.js');
 assert.match(routes,/verifierConnexion,verifierCsrf,limiter/);
 assert.match(model,/TASKLY_CHAT_PRESENCE_ENABLED/);
 assert.match(model,/INTERVAL 120 SECOND/);
});
