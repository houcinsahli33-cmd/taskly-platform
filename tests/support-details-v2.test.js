'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('details prive : route avec session authentifiee',()=>{
 const s=read('server/routes/contactRoutes.js');
 assert.match(s,/mes-messages\/:id.*verifierConnexion.*detailsMessageSupport/);
});
test('details : la demande appartient au proprietaire et seules les reponses envoyees sont retournees',()=>{
 const s=read('server/models/contactModel.js');
 assert.match(s,/WHERE id=\? AND user_id=\? AND contexte='public'/);
 assert.match(s,/support_reponses WHERE contact_id=\? AND statut='sent' AND envoyee_at IS NOT NULL/);
});
test('client et artisan : une seule fenetre de details identique',()=>{
 for(const role of ['client','artisan']){
  const s=read(`client/private/${role}/support.html`);
  assert.equal((s.match(/id="ts-support-details-dialog"/g)||[]).length,1);
  assert.match(s,/taskly-support-details\.js/);
  assert.doesNotMatch(s,/Retrouver un ancien message avec son numéro de suivi/);
 }
});
test('aucun HTML non fiable dans la fenetre',()=>{
 const s=read('client/public/js/taskly-support-details.js');
 assert.match(s,/body\.textContent = reply\.corps/);
 assert.doesNotMatch(s,/\.innerHTML\s*=/);
});
