'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');

const {adresse}=require(
    '../server/services/professionalMailPolicy'
);

const client={
    id:123,
    role:'client',
    nom:'Exemple',
    prenom:'Ali'
};

const artisan={
    id:124,
    role:'artisan',
    nom:'Exemple',
    prenom:'Ali',
    service_nom:'Plomberie',
    service_id:1
};

test('Mail Client : adresse interne valide',()=>{
    assert.equal(
        adresse(client,'taskly.test'),
        'exemple.ali@client.taskly.test'
    );
});

test('Mail Client : distinction des espaces',()=>{
    assert.notEqual(
        adresse(client,'taskly.test'),
        adresse(artisan,'taskly.test')
    );
});

test('Mail Client : gestion des homonymes',()=>{
    assert.equal(
        adresse(client,'taskly.test',true),
        'exemple.ali.123@client.taskly.test'
    );
});

test('Mail Artisan : adresse originale conservee',()=>{
    assert.equal(
        adresse(artisan,'taskly.test'),
        'exemple.ali@plomberie.taskly.test'
    );
});
const {modeClient}=require(
 '../server/services/professionalMailAccess'
);

const env={
 TASKLY_MAIL_PILOT_ENABLED:'true',
 TASKLY_MAIL_INTERNAL_ENABLED:'true',
 TASKLY_MAIL_GENERAL_ENABLED:'true',
 TASKLY_MAIL_AUTO_ACTIVATION:'true',
 TASKLY_MAIL_GATEWAY_ENABLED:'false',
 TASKLY_MAIL_CLIENT_ENABLED:'true'
};

test('Mail Client : activation autorisee',()=>{
 assert.equal(modeClient(env),true);
});

test('Mail Client : desactive par defaut',()=>{
 assert.equal(modeClient({}),false);
});

test('Mail Client : mode general obligatoire',()=>{
 assert.equal(modeClient({
  ...env,TASKLY_MAIL_GENERAL_ENABLED:'false'
 }),false);
});

test('Mail Client : interrupteur independant',()=>{
 assert.equal(modeClient({
  ...env,TASKLY_MAIL_CLIENT_ENABLED:'false'
 }),false);
});