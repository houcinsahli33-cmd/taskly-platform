"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('titre de chaque demande dynamique et maintien des actions originales',()=>{
 const js=read('client/public/js/artisan-dashboard.js');
 assert.match(js,/Demande n° \${numero}/);
 assert.match(js,/const numero = Number\(d\.id\)/);
 assert.match(js,/\/api\/demandes\/.*\/details/);
 assert.match(js,/data-open-report/);
 assert.match(js,/data-taskly-route/);
 assert.match(js,/maps\/embed\/v1\/directions/);
 assert.match(js,/maps\/dir/);
 assert.match(js,/dialogue\.showModal\(\)/);
});
test('flèche visible seulement en cas de débordement',()=>{
 const js=read('client/public/js/artisan-dashboard.js');
 assert.match(js,/message\.scrollHeight > message\.clientHeight \+ 2/);
 assert.match(js,/developper\.hidden/);
});
test('déconnexion artisan reprend les pictogrammes client sans modifier la session',()=>{
 const client=read('client/private/client/accueil.html');
 const icon=client.match(/(<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4[^<]+<\/path><\/svg>)/)[1];
 for(const name of ['accueil','demandes','profil','support','avis']) {
  const artisan=read('client/private/artisan/'+name+'.html');
  assert.ok(artisan.includes('<button type="button" data-logout>'+icon+'Déconnexion</button>'));
 }
});
test('calendrier conserve ses validations et l’icône demandée',()=>{
 assert.match(read('client/public/js/taskly-request-calendar.js'),/taskly-calendar-launch/);
 assert.match(read('client/public/css/taskly-request-calendar.css'),/color:#7045ed/);
 assert.match(read('server/helpers/requestDate.js'),/verifierDateSouhaitee/);
});
