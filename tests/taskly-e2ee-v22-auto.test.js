'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'client/public/js/taskly-e2ee-auto-keys.js'),'utf8');
const uuid='11fb9d9f-f8c9-4b57-aa5d-4d0b27efa082';
const getKeys=()=>{
  const window={crypto:webcrypto};
  vm.runInNewContext(source,{window, btoa,atob, TextEncoder,Uint8Array, ArrayBuffer,Error,Number});
  return window.TasklyE2EEAutoKeys;
};
test('ECDH auto: cle identique sur deux appareils sans serveur qui connait le secret',async()=>{
  const api=getKeys();
  assert.equal(typeof api.create,'function');
  const a=await api.create();const b=await api.create();
  assert.match(a.publicKey,/^[A-Za-z0-9_-]{87}$/);
  assert.equal(a.privateKey.extractable,false);
  const ka=await api.derive(a,b.publicKey,uuid,270002);
  const kb=await api.derive(b,a.publicKey,uuid,270002);
  assert.equal(ka.byteLength,32);
  assert.deepEqual(Buffer.from(ka),Buffer.from(kb));
  const accept=await api.proof(ka,uuid,'accept');
  const caller=await api.proof(kb,uuid,'caller');
  assert.equal(await api.verify(kb,uuid,'accept',accept),true);
  assert.equal(await api.verify(ka,uuid,'caller',caller),true);
  assert.equal(await api.verify(ka,uuid,'caller',accept),false);
});
test('ECDH auto: mauvaise cle, mauvais appel ou demande refuses',async()=>{
  const api=getKeys();
  const a=await api.create();const b=await api.create();const c=await api.create();
  const k=await api.derive(a,b.publicKey,uuid,270002);
  const wrong=await api.derive(b,c.publicKey,uuid,270002);
  assert.equal(await api.verify(wrong,uuid,'accept',await api.proof(k,uuid,'accept')),false);
  const different=await api.derive(b,a.publicKey,uuid,270003);
  assert.notDeepEqual(Buffer.from(k),Buffer.from(different));
  await assert.rejects(api.derive(a,'bad',uuid,270002),/Cle/);
  await assert.rejects(api.derive(a,b.publicKey,'bad',270002),/Contexte/);
});
test('Serveur pilote: flag tous appels et signalisation publique seulement',()=>{
  const controller=fs.readFileSync(path.join(root,'server/controllers/chatController.js'),'utf8');
  const signaling=fs.readFileSync(path.join(root,'server/services/chatCallService.js'),'utf8');
  const ui=fs.readFileSync(path.join(root,'client/public/js/taskly-call-ui.js'),'utf8');
  assert.match(controller,/TASKLY_E2EE_ALL_CALLS/);
  assert.match(signaling,/e2eeOfferKey/);
  assert.match(signaling,/e2eeAnswerKey/);
  assert.match(signaling,/e2eeCallerProof/);
  assert.match(ui,/waitForE2EEConfirmation/);
  assert.match(ui,/TasklyE2EEAutoKeys/);
  assert.doesNotMatch(signaling,/e2eeKey\s*=/);
  assert.doesNotMatch(ui,/TasklyE2EEManualKeys\.(requireKey|generate)/);
});
test('E2EE auto: meme script charge dans les deux espaces, V19 conserve',()=>{
  for (const role of ['client','artisan']) {
    const html=fs.readFileSync(path.join(root,`client/private/${role}/messagerie.html`),'utf8');
    assert.match(html,/taskly-e2ee-auto-keys\.js/);
    assert.match(html,/taskly-call-livekit\.js\?v=19-restored/);
  }
  assert.equal(fs.readFileSync(path.join(root,'client/public/js/taskly-call-livekit.js'),'utf8')
    .includes('window.TasklyCallLiveKit = TasklyCallLiveKit'),true);
});
