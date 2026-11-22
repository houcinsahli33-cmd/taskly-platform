'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {adresse}=require('../server/services/professionalMailPolicy');
const {internalAddress}=require('../server/services/professionalMailInternal');
const root=path.join(__dirname,'..');

test('Taskly Mail : nouvelles adresses .dz acceptees pour client et artisan',()=>{
  const client={id:123,role:'client',nom:'Exemple',prenom:'Ali'};
  const artisan={id:124,role:'artisan',nom:'Exemple',prenom:'Ali',service_nom:'Plomberie',service_id:1};
  assert.equal(adresse(client,'taskly.dz'),'exemple.ali@client.taskly.dz');
  assert.equal(adresse(artisan,'taskly.dz'),'exemple.ali@plomberie.taskly.dz');
  assert.equal(internalAddress('exemple.ali@client.taskly.dz'),true);
  assert.equal(internalAddress('exemple.ali@plomberie.taskly.dz'),true);
});

test('Taskly Mail : les anciennes adresses .test restent valides',()=>{
  assert.equal(internalAddress('exemple.ali@client.taskly.test'),true);
  assert.equal(internalAddress('exemple.ali@plomberie.taskly.test'),true);
});

test('Taskly Mail : rejeter les domaines externes et suffixes voisins',()=>{
  for(const bad of ['x@gmail.com','x@client.taskly.dzz','x@client.taskly.test.evil.com','x@taskly.dz','x@client.taskly.dz.evil.org']){
    assert.equal(internalAddress(bad),false,bad);
  }
});

test('Taskly Mail : generation interne .dz uniquement; la passerelle SMTP reste inchangee',()=>{
  const route=fs.readFileSync(path.join(root,'server/routes/professionalMailRoutes.js'),'utf8');
  assert.match(route,/internalMode\?'taskly\.dz':process\.env\.TASKLY_MAIL_DOMAIN/);
  const gateway=fs.readFileSync(path.join(root,'server/services/professionalMailInternal.js'),'utf8');
  assert.ok(gateway.includes('(?:test|dz)'), 'Les deux extensions doivent etre acceptees');
});
