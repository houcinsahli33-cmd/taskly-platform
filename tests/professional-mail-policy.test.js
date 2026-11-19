'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {adresse,domaine,empreinte,codeValide}=require('../server/services/professionalMailPolicy');
const p={id:42,nom:'Ben Ali',prenom:'Élodie',service_nom:'Électricité',service_id:5};
test('adresse automatique par métier, normalisée, collision isolée',()=>{assert.equal(adresse(p,'example.test'),'ben-ali.elodie@electricite.example.test');assert.equal(adresse(p,'example.test',true),'ben-ali.elodie.42@electricite.example.test');assert.notEqual(adresse(p,'example.test'),adresse({...p,service_nom:'Plomberie'},'example.test'));});
test('domaine configuré obligatoire; refuse URL et caractères invalides',()=>{for(const d of ['', 'https://example.test','x@example.test','-bad.test','test..com'])assert.equal(domaine(d),null);assert.throws(()=>adresse(p,''));});
test('code lié au profil et à l’adresse; rejette mauvais code ou compte',()=>{const secret='local-test-secret'.repeat(3),a=adresse(p,'example.test');const row={user_id:42,proposed_address:a,code_hash:empreinte(secret,42,a,'012345')};assert.equal(codeValide(secret,row,'012345'),true);assert.equal(codeValide(secret,row,'012346'),false);assert.equal(codeValide(secret,{...row,user_id:43},'012345'),false);assert.equal(codeValide(secret,{...row,code_hash:'x'},'012345'),false);});
