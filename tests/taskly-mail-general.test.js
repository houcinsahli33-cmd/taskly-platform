'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');

const {modeGeneral}=require(
    '../server/services/professionalMailAccess'
);

const config={
    TASKLY_MAIL_PILOT_ENABLED:'true',
    TASKLY_MAIL_INTERNAL_ENABLED:'true',
    TASKLY_MAIL_GENERAL_ENABLED:'true',
    TASKLY_MAIL_AUTO_ACTIVATION:'true',
    TASKLY_MAIL_GATEWAY_ENABLED:'false'
};

test('Mail general : configuration valide',()=>{
    assert.equal(modeGeneral(config),true);
});

test('Mail general : desactive par defaut',()=>{
    assert.equal(modeGeneral({}),false);
});

test('Mail general : interrupteur principal obligatoire',()=>{
    assert.equal(modeGeneral({
        ...config,
        TASKLY_MAIL_PILOT_ENABLED:'false'
    }),false);
});

test('Mail general : mode interne obligatoire',()=>{
    assert.equal(modeGeneral({
        ...config,
        TASKLY_MAIL_INTERNAL_ENABLED:'false'
    }),false);
});

test('Mail general : activation automatique obligatoire',()=>{
    assert.equal(modeGeneral({
        ...config,
        TASKLY_MAIL_AUTO_ACTIVATION:'false'
    }),false);
});

test('Mail general : fournisseur externe interdit',()=>{
    assert.equal(modeGeneral({
        ...config,
        TASKLY_MAIL_GATEWAY_ENABLED:'true'
    }),false);
});

test('Mail general : maintien du mode pilote',()=>{
    assert.equal(modeGeneral({
        ...config,
        TASKLY_MAIL_GENERAL_ENABLED:'false'
    }),false);
});