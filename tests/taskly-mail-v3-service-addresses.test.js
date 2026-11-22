'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {SERVICE_ADDRESSES,normalizeAddress,serviceForAddress,reservedServiceAddress} = require('../server/services/tasklyMailSystemAddresses');

test('V3: les deux adresses de service ont des identites distinctes', () => {
  assert.equal(SERVICE_ADDRESSES.administration,'administration@taskly.dz');
  assert.equal(SERVICE_ADDRESSES.support,'support@taskly.dz');
  assert.notEqual(SERVICE_ADDRESSES.administration,SERVICE_ADDRESSES.support);
  assert.equal(serviceForAddress(SERVICE_ADDRESSES.administration),'administration');
  assert.equal(serviceForAddress(SERVICE_ADDRESSES.support),'support');
});
test('V3: normalisation seulement pour comparaison, aucune modification de donnees', () => {
  assert.equal(normalizeAddress('  SUPPORT@TASKLY.DZ  '),'support@taskly.dz');
  assert.equal(serviceForAddress('  SUPPORT@TASKLY.DZ  '),'support');
  assert.equal(normalizeAddress(null),'');
});
test('V3: sous-domaines, suffixes voisins et noms ressemblants refuses', () => {
  for (const bad of ['admin@taskly.dz','support@client.taskly.dz','support@taskly.dz.evil','support@taskly.test','support+user@taskly.dz','support@taskly.dz\nBcc: x','user@client.taskly.dz','']) {
    assert.equal(serviceForAddress(bad),null,bad);
    assert.equal(reservedServiceAddress(bad),false,bad);
  }
});
test('V3: une adresse reservee ne constitue pas une authentification', () => {
  assert.equal(reservedServiceAddress('support@taskly.dz'),true);
  assert.equal('checkAdminAuthorization' in require('../server/services/tasklyMailSystemAddresses'),false);
});
test('V3: registre immuable', () => {
  assert.equal(Object.isFrozen(SERVICE_ADDRESSES),true);
});
