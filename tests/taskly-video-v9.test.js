'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const call=read('client/public/js/taskly-call-maquette-v8.js');
const css=read('client/public/css/taskly-call-maquette-v8.css');
const shell=read('client/public/js/taskly-call-host-shell.js');
const chat=read('client/public/js/taskly-chat-workspace.js');
const notif=read('client/public/js/taskly-call-notifications.js');
test('V9 vidéo utilise le flux LiveKit existant sans inventer de caméra',()=>{
 assert.match(call,/dialog\.querySelector\('\.tc-videos'\)/);
 assert.match(call,/videoBox\.prepend\(videos\)/);
 assert.match(call,/info\.actionArea\.append\(info\.hang\)/);
 assert.match(call,/info\.videoRemoteLabel\.textContent=nameSafe\(dialog\)/);
 assert.match(css,/\.tc-v9-remote-label/);
 assert.match(css,/\[data-tc=remote\]/);
 assert.match(css,/\[data-tc=local\]/);
 assert.doesNotMatch(call,/getUserMedia\(|new Room\(/);
});
test('V9: la vidéo V8 fonctionne sans la classe legacy v6',()=>{
 assert.match(css,/\.taskly-call-dialog\.taskly-call-premium\[data-taskly-v8-ready='1'\]\[data-mode='video'\]/);
 assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});
test('Partage écran: permission du navigateur et uniquement appel connecté',()=>{
 assert.match(shell,/microphone; camera; autoplay; display-capture/);
 assert.match(call,/dialog\.dataset\.premiumStage!=='connected'/);
 assert.match(call,/setScreenShareEnabled\(next\)/);
 assert.doesNotMatch(call,/getDisplayMedia\(\)\.then/);
});
test('Historique: SVG camera/telephone, pas d emoji injecté',()=>{
 assert.match(chat,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/);
 assert.match(chat,/card\.dataset\.callMode=m\.mode/);
 assert.match(css,/\.cw-call-event\[data-call-mode=video\] \.cw-call-event-icon/);
});
test('Navigation d appel dans tableau de bord, pas une fenetre navigateur séparée',()=>{
 assert.doesNotMatch(notif,/window\.open\(/);
 assert.match(notif,/window\.TasklyCallHost\?\.open/);
});
test('Sonnerie si Taskly reste ouvert: invitation vérifiée côté API, même onglet masqué',()=>{
 assert.match(notif,/api\/demandes\/chat\/calls\/incoming/);
 assert.doesNotMatch(notif,/document\.visibilityState !== 'visible'/);
 assert.match(notif,/document\.addEventListener\('visibilitychange'/);
});
test('Les pages Client et Artisan gardent leur interface et chargent les nouveaux fichiers',()=>{
 for(const role of ['client','artisan']){
  const html=read(`client/private/${role}/messagerie.html`);
  assert.match(html,/taskly-call-maquette-v8\.css\?v=9/);
  assert.match(html,/taskly-call-maquette-v8\.js\?v=9/);
  assert.match(html,/taskly-chat-workspace\.js\?v=calls-v9/);
  assert.match(html,/taskly-call-livekit\.js/);
 }
});
test('En ligne seulement si appel autorisé et réellement connecté',()=>{
 assert.match(call,/const connected = dialog\.dataset\.premiumStage === 'connected'/);
 assert.match(call,/info\.presence\.hidden=!connected/);
});
