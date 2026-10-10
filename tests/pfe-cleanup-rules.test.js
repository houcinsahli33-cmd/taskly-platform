const {test}=require('node:test'),assert=require('node:assert/strict');
const {correspond,candidat}=require('../scripts/pfe-cleanup-rules');
test('nettoyage : uniquement les trois identifiants autorisés',()=>{
 for(const email of ['HOUCINSAHLI33@gmail.com','sahliredha03@example.com','houcinshl03@example.com'])assert.equal(candidat({role:'artisan',email}),true);
 for(const email of ['sahli@example.com','prenom@shl-example.dz','autre.houcinsahli33@gmail.com'])assert.equal(correspond(email),false);
});
test('nettoyage : administrateurs exclus',()=>{assert.equal(candidat({role:'admin',email:'houcinsahli33@gmail.com'}),false);assert.equal(candidat(null),false);});
