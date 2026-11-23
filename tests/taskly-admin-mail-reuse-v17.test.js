'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');const path=require('node:path');const root=path.join(__dirname,'..');
const {spawnSync}=require('node:child_process');
const protectedFiles=["client/private/client/messagerie.html", "client/private/artisan/messagerie.html", "client/public/js/taskly-chat-workspace.js", "client/public/js/taskly-call-livekit.js", "client/public/js/taskly-call-ui.js", "client/public/js/taskly-call-media.js", "server/controllers/chatController.js", "server/routes/demandeRoutes.js", "server/services/livekitTokenService.js", "client/private/client/taskly-mail.html", "client/private/artisan/taskly-mail.html", "client/public/js/professional-mail-folders.js", "client/public/js/professional-mailbox.js"];
test('V17: protected client/artisan messaging and LiveKit unchanged since cab4400',(t)=>{
  const hasGit=spawnSync('git',['rev-parse','--verify','cab4400'],{cwd:root,encoding:'utf8'});
  if(hasGit.status!==0){t.skip('Archive sans dossier .git : verifier dans la branche locale');return;}
  for(const args of [['diff','--quiet','cab4400','--',...protectedFiles],['diff','--quiet','--',...protectedFiles]]){
    const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});
    assert.equal(r.status,0,`Protected files differ: ${r.stderr||r.stdout}`);
  }
});
test('V17: admin uses genuine shared client mail stylesheet and isolated adapter',()=>{const html=fs.readFileSync(path.join(root,'client/private/admin/taskly-mail.html'),'utf8');assert.match(html,/\/css\/professional-mailbox\.css\?v=104/);assert.match(html,/\/css\/taskly-admin-mail-reuse-v17\.css\?v=1/);assert.ok(html.indexOf('professional-mailbox.css?v=104')<html.indexOf('taskly-admin-mail-reuse-v17.css?v=1'));const css=fs.readFileSync(path.join(root,'client/public/css/taskly-admin-mail-reuse-v17.css'),'utf8');assert.ok(css.includes('.tmv3-admin-page #tmv6-admin-mail'));});
test('V17: existing secure admin mailbox API is retained and support not mislabeled private',()=>{const html=fs.readFileSync(path.join(root,'client/private/admin/taskly-mail.html'),'utf8');assert.match(html,/Conversations Support/);const js=fs.readFileSync(path.join(root,'client/public/js/taskly-admin-mail-v10.js'),'utf8');assert.match(js,/\/api\/admin\/taskly-mail-v10/);});
