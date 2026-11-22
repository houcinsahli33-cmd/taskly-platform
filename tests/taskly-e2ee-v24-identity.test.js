'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname,
    '../client/public/js/taskly-e2ee-identity-v24.js'), 'utf8');
function setup() {
    const window = { crypto: webcrypto };
    vm.runInNewContext(source, { window, TextEncoder, Uint8Array,
        Number, btoa, atob, Error, Object, JSON, String, Array });
    return window.TasklyE2EEIdentityV24;
}
const id = '11fb9d9f-f8c9-4b57-aa5d-4d0b27efa082';
async function sampleSession() {
    const pair = await webcrypto.subtle.generateKey(
        {name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
    const raw = new Uint8Array(await webcrypto.subtle.exportKey('raw',pair.publicKey));
    const ephemeralPublicKey = Buffer.from(raw).toString('base64url');
    return {role:'client',accountId:150002,demandeId:270002,
        callId:id,ephemeralPublicKey};
}

test('V24 : cle d identite non exportable, empreinte stable', async () => {
    const api = setup();
    const alice = await api.generateIdentity('client',150002);
    assert.equal(alice.privateKey.extractable,false);
    const fp1 = await api.fingerprint(alice.identityPublicKey);
    assert.match(fp1, /^[a-f0-9]{64}$/);
    assert.equal(await api.fingerprint(alice.identityPublicKey), fp1);
    assert.match(await api.shortVerificationCode(alice.identityPublicKey),
        /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
});
test('V24 : verification signee avec empreinte independante validee', async () => {
    const api=setup();const alice=await api.generateIdentity('client',150002);
    const session=await sampleSession();
    const packet=await api.signHandshake(alice,session);
    const fp=await api.fingerprint(alice.identityPublicKey);
    assert.equal(await api.verifyHandshake(packet,session,fp),true);
});
test('V24 : sans empreinte externe verifiee, refus ferme', async () => {
    const api=setup();const alice=await api.generateIdentity('client',150002);
    const session=await sampleSession();
    const packet=await api.signHandshake(alice,session);
    await assert.rejects(api.verifyHandshake(packet,session,null),/non verifiee/);
});
test('V24 : une substitution de la cle publique du pair est refusee', async () => {
    const api=setup();const alice=await api.generateIdentity('client',150002);
    const impostor=await api.generateIdentity('client',150002);
    const trusted=await api.fingerprint(alice.identityPublicKey);
    const session=await sampleSession();
    const forged=await api.signHandshake(impostor,session);
    await assert.rejects(api.verifyHandshake(forged,session,trusted),/modifiee/);
});
test('V24 : modifier la cle ephemere apres signature est detecte', async () => {
    const api=setup();const alice=await api.generateIdentity('client',150002);
    const session=await sampleSession();
    const packet=await api.signHandshake(alice,session);
    const fp=await api.fingerprint(alice.identityPublicKey);
    const other=await sampleSession();
    const modified={...packet,ephemeralPublicKey:other.ephemeralPublicKey};
    await assert.rejects(api.verifyHandshake(modified,session,fp),/Signature/);
});
test('V24 : rejeu sur autre appel, demande, compte et role refuses', async () => {
    const api=setup();const alice=await api.generateIdentity('client',150002);
    const session=await sampleSession();
    const packet=await api.signHandshake(alice,session);
    const fp=await api.fingerprint(alice.identityPublicKey);
    for (const altered of [
        {...session, callId:'9cfbfccf-3d0b-4428-82f2-a0ca0d9e1e53'},
        {...session, demandeId:270003},
        {...session, accountId:150003},
        {...session, role:'artisan'}
    ]) {
        await assert.rejects(api.verifyHandshake(packet,altered,fp),/incoherent/);
    }
});
test('V24 : le module est autonome et ne modifie pas les appels existants', () => {
    assert.doesNotMatch(source, /TasklyCallLiveKit\s*=/);
    assert.doesNotMatch(source, /TasklyCallUI\s*=/);
    assert.doesNotMatch(source, /fetch\(/);
    assert.doesNotMatch(source, /global\.localStorage/);
});
