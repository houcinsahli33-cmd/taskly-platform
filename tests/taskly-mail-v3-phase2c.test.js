'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Support V3 routes: listes limitees aux sessions',()=>{let s=read('server/routes/tasklyMailServiceV3Routes.js');assert.match(s,/service\.listForUser\(req\.session\.utilisateur\.id\)/);assert.match(s,/service\.listForAdmin\(adminContext\(req\)\)/);});
test('Support V3 service: filtre user_id et Support',()=>{let s=read('server/services/tasklyMailServiceThreads.js');assert.match(s,/WHERE user_id=\? AND service_name='support'/);assert.match(s,/await checkAdmin\(adminContext\)/);assert.match(s,/LIMIT 50/);});
test('Support V3: aucune substitution de support historique',()=>{for(const f of ['client/private/client/support.html','client/private/artisan/support.html']){let s=read(f);assert.match(s,/id="contact-form"/);assert.match(s,/taskly-mail-v3-support/);}});
test('Support V3: scripts distincts et rendering texte',()=>{let s=read('client/public/js/taskly-mail-v3-support.js');assert.doesNotMatch(s,/innerHTML|outerHTML|insertAdjacentHTML/);assert.match(s,/textContent/);assert.match(s,/support@taskly\.dz/);});
