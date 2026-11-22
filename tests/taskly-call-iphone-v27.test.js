 'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,'client/public/js',name),'utf8');

test('V27 : la conversation de la fenetre d appel est ouverte avant le chargement de la liste',()=>{
  const text=source('taskly-chat-workspace.js');
  assert.match(text,/if\(hostCallPage&&Number\.isSafeInteger\(first\)[^;]+\)open\(first\);await refreshList\(\)/);
});

test('V27 : les autres messageries conservent le chargement habituel et ne s ouvrent pas deux fois',()=>{
  const text=source('taskly-chat-workspace.js');
  assert.match(text,/if\(!hostCallPage&&first\)open\(first\);else if\(!hostCallPage&&list\.length/);
  assert.match(text,/if\(!hostCallPage&&first\)open\(first\)/);
});

test('V27 : le mode entrant recherche immediatement l appel en cours, sans limiter a dix secondes',()=>{
  const text=source('taskly-call-floating.js');
  assert.match(text,/requestedMode === 'receive'[\s\S]*?this\.poll\(\)/);
  assert.match(text,/this\.lastIdlePoll = 0/);
  assert.match(text,/this\.context\?\.id === selectedId && !this\.active/);
});

test('V27 : le contexte et les autorisations restent verifies par le serveur avant tout appel',()=>{
  const text=source('taskly-chat-workspace.js');
  assert.match(text,/await requeteAPI\(base\+'\/'\+id\+'\/chat'\)/);
  assert.match(text,/data\.informations\?\.statut===\"acceptee\"/);
  assert.match(text,/calls\?\.select\(id,\$\(\"cw-person-name\"\)\.textContent,callAllowed\)/);
});

test('V27 : les blocages de conversation sont signales sans diffuser de message du serveur',()=>{
  const host=source('taskly-call-host-shell.js');
  const chat=source('taskly-chat-workspace.js');
  for(const reason of ['calls-disabled','not-eligible','conversation-unavailable']){
    assert.ok(host.includes(`'${reason}'`),reason);
    assert.ok(chat.includes(`'${reason}'`),reason);
  }
  assert.match(host,/event\.origin !== location\.origin \|\| !frame \|\| event\.source !== frame\.contentWindow/);
  assert.doesNotMatch(chat,/notifyHost\([^)]*e\.message/);
});

test('V27 : l ecran de chargement ne remplace plus une erreur precise apres 18 secondes',()=>{
  const host=source('taskly-call-host-shell.js');
  assert.match(host,/18000/);
  assert.match(host,/\/\^\(Connexion à votre appel\|Chargement de la conversation\)\//);
  assert.match(host,/taskly:call-host-mode/);
});

function boot(mode) {
  const events=[];
  class CallUI {
    select(id,name,enabled){this.context=enabled?{id}:null;return 'selection';}
    poll(){events.push(['poll',this.lastIdlePoll]);}
    start(mode){events.push(['start',mode]);}
  }
  const win={TasklyCallUI:CallUI,addEventListener(){},parent:{postMessage(){}},top:{location:{origin:'https://taskly.test'}}};
  const doc={documentElement:{dataset:{}},body:{setAttribute(){}},addEventListener(){}};
  const sandbox={window:win,document:doc,location:{search:`?taskly_call_host=1&conversation=270002&taskly_call_mode=${mode}`,origin:'https://taskly.test'},URLSearchParams,Promise,WeakSet,console};
  vm.runInNewContext(source('taskly-call-floating.js'),sandbox);
  return {instance:new CallUI(),events};
}

test('V27 : a la selection entrante, le poll commence sans etre bloque par l ancien compteur',async()=>{
  const {instance,events}=boot('receive');instance.lastIdlePoll=Date.now();
  instance.select(270002,'Interlocuteur',true);
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(events,[['poll',0]]);
});

test('V27 : le lancement sortant audio reste unique et independant du polling entrant',async()=>{
  const {instance,events}=boot('audio');
  instance.select(270002,'Interlocuteur',true);
  await Promise.resolve();await Promise.resolve();
  instance.select(270002,'Interlocuteur',true);
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(events,[['start','audio']]);
});
