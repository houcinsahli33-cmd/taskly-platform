 'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('client/public/js/taskly-call-maquette-v8.js');
const css=read('client/public/css/taskly-call-maquette-v8.css');
for(const role of ['client','artisan']) {
 test('V8 loaded in '+role+' private messaging after persistent window',()=>{
  const html=read('client/private/'+role+'/messagerie.html');
  assert.match(html,/taskly-call-maquette-v8\.css\?v=12/);
  assert.match(html,/taskly-call-maquette-v8\.js\?v=12/);
  assert.ok(html.indexOf('taskly-call-floating.js')<html.indexOf('taskly-call-maquette-v8.js'));
  assert.match(html,/taskly-call-livekit\.js/);
 });
}
test('Design is isolated to call host, not dashboard/sidebar',()=>{
 assert.match(css,/data-taskly-call-host='1'/);
 assert.match(css,/\.tc-v8-board/);
 assert.doesNotMatch(css,/\.sidebar\s*\{|#site-header\s*\{/);
 assert.match(css,/radial-gradient/);
 assert.match(css,/tc-v8-bottom-art/);
});
test('Screenshot hierarchy: light header, contact, hero, wave, controls and red hangup',()=>{
 for(const fragment of ['tc-v8-contact-avatar','tc-v8-online','tc-v8-hero','tc-v8-avatar','tc-v8-clock','tc-v8-wave','tc-v8-actions','tc-v8-hang'])
  assert.ok(js.includes(fragment),fragment);
 assert.match(css,/background:linear-gradient\(#ff5050,#de1818\)/);
});
test('Unread count is fetched from authenticated existing chat API, never guessed',()=>{
 assert.match(js,/requeteAPI\('\/api\/demandes\/chat\/unread'\)/);
 assert.match(js,/Number\.isSafeInteger\(total\)/);
 assert.match(js,/badge\.hidden=total===0/);
 assert.match(js,/total>99\?'99\+':String\(total\)/);
 assert.doesNotMatch(js,/total\s*=\s*2\s*;/);
});
test('Green online presence only reflects connected call stage',()=>{
 assert.match(js,/dialog\.dataset\.premiumStage === 'connected'/);
 assert.match(js,/info\.presence\.hidden=!connected/);
 assert.match(css,/\[data-premium-stage=connected\] \.tc-v8-board/);
});
test('Audio and video share the same real call controls, no fake media',()=>{
 for(const name of ['toggleMicrophone','toggleCamera','setScreenShareEnabled','instance.finish','remote.play']) assert.ok(js.includes(name),name);
 assert.match(js,/dialog\.dataset\.mode === 'video'/);
 assert.match(js,/existingVideos=panel\.querySelector\('\.tc-videos'\)/);
 assert.match(js,/videoStage\.append\(existingVideos\)/);
 assert.match(css,/\[data-tc=remote\]/);
 assert.match(css,/\[data-tc=local\]/);
 assert.doesNotMatch(js,/new LivekitClient|new Room\(|getUserMedia\(/);
});
test('Close, maximize, chat and device buttons delegate to existing real actions',()=>{
 assert.match(js,/notify\('max'\)/);
 assert.match(js,/notify\('chat'\)/);
 assert.match(js,/native\.click\(\)/);
 assert.match(js,/instance\.finish\(/);
 assert.match(js,/event\.origin|window\.parent\.postMessage/);
});
test('Missing browser screen share is reported, not faked',()=>{
 assert.match(js,/typeof room\?\.localParticipant\?\.setScreenShareEnabled!==\s*'function'/);
 assert.match(js,/Partage d’écran refusé ou indisponible/);
});
test('Client and Artisan behavior persists across second calls',()=>{
 assert.match(js,/if \(instances\.has\(dialog\)\)/);
 assert.match(js,/prior\.resumeUnread\?\.\(\)/);
 assert.match(js,/info\.unreadTimer=null/);
 assert.match(js,/dialog\.addEventListener\('close'/);
});
test('Untrusted names are inserted using textContent, not interpolated into HTML',()=>{
 assert.match(js,/el\.textContent=label/);
 assert.match(js,/text\(info\.person,name\)/);
 assert.doesNotMatch(js,/innerHTML\s*=\s*.*\$\{/);
});
test('V8 uses a separate CSS/JS layer, keeping LiveKit V7 and V6 intact',()=>{
 const html=read('client/private/client/messagerie.html');
 assert.match(html,/taskly-call-premium\.js/);
 assert.match(html,/taskly-call-floating\.js/);
 assert.doesNotMatch(js,/fetch\('\/api\/demandes\/.*calls\//);
});

test('Persistent call iframe overrides V3 width and height without altering other dialogs',()=>{
 assert.match(css,/TASKLY_CALL_CASCADE_V2/);
 assert.match(css,/html\[data-taskly-call-host='1'\] body\[data-workspace-page='messagerie'\]/);
 assert.match(css,/\[data-mode='video'\]/);
 assert.match(css,/width:100%!important/);
 assert.match(css,/height:100%!important/);
});
