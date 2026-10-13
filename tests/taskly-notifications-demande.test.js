'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '..');
function preparer(modif = 1) {
    const envois = [], attempted = [];
    const model = {
        creerDemande: async () => ({insertId: 42}),
        modifierStatutDemande: async () => ({affectedRows: modif}),
        trouverDestinataires: async () => ({
            client_user_id: 12, client_email: 'client@example.test', client_nom: 'Client', client_prenom: 'Marie',
            artisan_user_id: 99, artisan_email: 'artisan@example.test', artisan_nom: 'Artisan', artisan_prenom: 'Paul'
        })
    };
    const mail = {
        base: () => 'https://taskly.example.test',
        mettreEnFile: async x => {envois.push(x)},
        traiterLot: async () => {attempted.push(true)}
    };
    const mocks = {
        '../models/demandeModel': model,
        '../models/clientModel': {trouverClientParUserId: async () => ({id: 7})},
        '../models/artisanModel': {trouverArtisanParUserId: async () => ({id: 8}),trouverArtisanParId: async () => ({id: 8})},
        '../services/tasklyMail': mail
    };
    const file = path.join(base,'server/controllers/demandeController.js');
    const source = fs.readFileSync(file, 'utf8');
    const m = {exports:{}};
    vm.runInNewContext('(function(require,module,exports){'+source+'\n})', {console})(k => {
        if (Object.hasOwn(mocks,k)) return mocks[k];
        throw new Error('Unexpected require '+k);
    },m,m.exports);
    return {controller:m.exports,envois,attempted};
}
function res() {
    return {statusCode:200,body:null,status(v){this.statusCode=v;return this},json(v){this.body=v;return this}};
}
test('nouvelle demande : e-mail seulement à l’artisan concerné',async()=>{
    const {controller,envois,attempted} = preparer();
    const response = res();
    await controller.creerDemande({body:{artisanId:8,message:'Dépannage',adresse:'Paris'},session:{utilisateur:{id:12}}},response);
    assert.equal(response.statusCode,201);
    assert.equal(envois.length,1);
    assert.equal(envois[0].to,'artisan@example.test');
    assert.equal(envois[0].key,'demande:42:nouvelle');
    assert.equal(attempted.length,1);
});
test('acceptation : e-mail uniquement au client',async()=>{
    const {controller,envois}=preparer();
    const response=res();
    await controller.modifierStatutDemande({params:{id:42},body:{statut:'acceptee'},session:{utilisateur:{id:99}}},response);
    assert.equal(response.statusCode,200);
    assert.equal(envois[0].to,'client@example.test');
    assert.match(envois[0].subject,/acceptée/);
});
test('refus : e-mail au client avec proposition d’autre artisan',async()=>{
    const {controller,envois}=preparer();
    const response=res();
    await controller.modifierStatutDemande({params:{id:42},body:{statut:'refusee'},session:{utilisateur:{id:99}}},response);
    assert.equal(response.statusCode,200);
    assert.match(envois[0].message,/autre artisan/);
});
test('statut déjà traité : pas de notification',async()=>{
    const {controller,envois}=preparer(0);
    const response=res();
    await controller.modifierStatutDemande({params:{id:42},body:{statut:'refusee'},session:{utilisateur:{id:99}}},response);
    assert.equal(response.statusCode,400);
    assert.equal(envois.length,0);
});
test('statut non permis : pas de notification',async()=>{
    const {controller,envois}=preparer();
    const response=res();
    await controller.modifierStatutDemande({params:{id:42},body:{statut:'admin'},session:{utilisateur:{id:99}}},response);
    assert.equal(response.statusCode,400);
    assert.equal(envois.length,0);
});
