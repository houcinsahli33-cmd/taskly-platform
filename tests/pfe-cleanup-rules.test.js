const {test} = require('node:test');
const assert = require('node:assert/strict');
const {correspond,candidat} = require('../scripts/pfe-cleanup-rules');
test('motifs sahli et shl trouvés dans toute adresse, sans tenir compte de la casse',()=>{
  for (const email of ['SAHLI@exemple.com','redha.sAhLi03@example.com','nouveauSHLcompte@test.dz','prenom@shl-example.dz']) {
    assert.equal(correspond(email),true,email);
    assert.equal(candidat({role:'client',email}),true,email);
    assert.equal(candidat({role:'artisan',email}),true,email);
  }
  assert.equal(correspond('artisans@example.com'),false);
});
test('tous les administrateurs sont protégés, même si leur mail contient sahli ou shl',()=>{
  assert.equal(candidat({role:'admin',email:'SAHLI@exemple.com'}),false);
  assert.equal(candidat({role:'admin',email:'shl@exemple.com'}),false);
  assert.equal(candidat({role:'principal',email:'shl@exemple.com'}),false);
  assert.equal(candidat(null),false);
});
