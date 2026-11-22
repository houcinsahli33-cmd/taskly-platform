'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('V20 : cles aleatoires et imports en memoire uniquement', () => {
    const window = { crypto: { getRandomValues(bytes) { bytes.fill(0x3a); return bytes; } } };
    vm.runInNewContext(read('client/public/js/taskly-e2ee-manual-keys.js'), {window, Uint8Array, ArrayBuffer, Error});
    const keys = window.TasklyE2EEManualKeys;
    const hex = keys.generate();
    assert.equal(hex, '3a'.repeat(32));
    assert.equal(keys.ready(), true);
    assert.equal(keys.requireKey().byteLength, 32);
    assert.throws(() => keys.importHex('abcd'), /64 caracteres/);
    keys.clear();
    assert.equal(keys.ready(), false);
    assert.throws(() => keys.requireKey(), /Cle E2EE requise/);
    keys.importHex('ff'.repeat(32));
    assert.equal(new Uint8Array(keys.requireKey())[0], 255);
    assert.equal(keys.ready(), true);
});

test('V20 : SDK experimental charge sur demande sans remplacer V19', async () => {
    const normal = {Room: function V19Room() {}};
    const experimental = {
        Room: function V20Room() {},
        ExternalE2EEKeyProvider: function Provider() {},
        isE2EESupported: () => true
    };
    let loads = 0;
    const window = {LivekitClient:normal};
    const document = {
        createElement(tag) {
            assert.equal(tag, 'script');
            return {remove() {}};
        },
        head: {
            appendChild(script) {
                loads++;
                assert.match(script.src, /e2ee-pilot\.umd\.js/);
                window.LivekitClient = experimental;
                script.onload();
            }
        }
    };
    vm.runInNewContext(read('client/public/js/taskly-e2ee-sdk-v20.js'), {window, document, Promise, Error});
    assert.equal(window.LivekitClient, normal);
    assert.equal(window.TasklyE2EESdk.get(), null);
    assert.equal(await window.TasklyE2EESdk.load(), experimental);
    assert.equal(window.LivekitClient, normal);
    assert.equal(await window.TasklyE2EESdk.load(), experimental);
    assert.equal(loads, 1);
});

test('V20 : deux espaces utilisent le SDK et moteur distincts', () => {
    for (const role of ['client', 'artisan']) {
        const html = read(`client/private/${role}/messagerie.html`);
        const positions = [
            html.indexOf('/js/vendor/livekit-client.umd.js'),
            html.indexOf('/js/taskly-call-livekit.js'),
            html.indexOf('/js/taskly-e2ee-manual-keys.js'),
            html.indexOf('/js/taskly-call-livekit-e2ee-v20.js'),
            html.indexOf('/js/taskly-e2ee-sdk-v20.js'),
            html.indexOf('/js/taskly-call-ui.js')
        ];
        assert.ok(positions.every(pos => pos >= 0));
        assert.deepEqual([...positions].sort((a,b)=>a-b), positions);
    }
});

test('V20 : signalisation et jeton imposent meme mode sans exposer la cle', () => {
    const controller = read('server/controllers/chatController.js');
    const ui = read('client/public/js/taskly-call-ui.js');
    assert.match(controller, /TASKLY_E2EE_TEST_DEMANDE_IDS/);
    assert.match(controller, /demandeE2EE !== e2eeRequired/);
    assert.match(controller, /req\.body\?\.e2eeRequired === true/);
    assert.match(ui, /configuration\.e2eeRequired === true/);
    assert.match(ui, /remote\.e2eeRequired === true/);
    assert.match(ui, /Chiffrement non confirme par le serveur/);
    assert.match(ui, /TasklyCallLiveKitE2EE/);
    assert.doesNotMatch(controller, /e2eeKey|manualKeys|secretKey/);
});

function mockServer(env) {
    const calls = [];
    const model = {
        trouverDemande: async () => ({
            client_id: 7, artisan_id: 9, statut: 'acceptee', messagerie_bloquee: 0
        }),
        participantsAppelActifs: async () => true
    };
    const mockCall = {
        id: '8d3b8856-ccf3-4acd-9566-6f4737c1dc92',
        state: 'accepted', transport: 'livekit', mode: 'audio'
    };
    const service = {
        async signaler(access, action, body) {
            calls.push({action, body});
            if (action === 'start') return {code: 201, call: mockCall};
            return {code: 200, call: mockCall};
        }
    };
    const modules = {
        '../models/chatModel': model,
        '../services/chatCallPilot': {
            autoriseCompte: () => true,
            autoriseDemande: () => true,
            modeGeneral: () => true
        },
        '../models/clientModel': {trouverClientParUserId: async () => ({id: 7})},
        '../models/artisanModel': {trouverArtisanParUserId: async () => ({id:9,verification_statut:'approuve'})},
        '../services/chatCallService': service,
        '../services/chatCallInbox': {indexerInvitation: async () => {}},
        '../services/livekitTokenService': {
            creerJetonLiveKit: async () => ({token: 'testtoken', url: 'wss://test.invalid'})
        }
    };
    const module = {exports: {}};
    vm.runInNewContext(read('server/controllers/chatController.js'), {
        module, exports:module.exports,
        require(p) {if (!(p in modules)) throw new Error('unexpected module: '+p);return modules[p];},
        process: {env: {...env}}, console
    });
    const req = (method, body = {}) => ({
        method, body, params: {id:'123'}, session: {utilisateur: {role:'client',id:1}}
    });
    function response() {
        const obj = {code:200,body:null};
        return {
            result:obj,
            set() {return this;},
            status(code) {obj.code=code;return this;},
            json(data) {obj.body=data;return this;}
        };
    }
    return {controller:module.exports,req,response,calls,mockCall};
}

test('V20 : seul le serveur active le pilote pour une demande autorisee', async () => {
    const e = mockServer({
        TASKLY_E2EE_TEST_DEMANDE_IDS:'123',
        TASKLY_LIVEKIT_ENABLED:'true',
        TASKLY_LIVEKIT_BROWSER_ENABLED:'true'
    });
    let r=e.response();
    await e.controller.gererAppel(e.req('GET'),r);
    assert.equal(r.result.code,200);
    assert.equal(r.result.body.e2eeRequired,true);
    assert.equal(r.result.body.call.e2eeRequired,true);

    r=e.response();
    await e.controller.gererAppel(e.req('POST',{action:'start',mode:'audio',transport:'livekit'}),r);
    assert.equal(r.result.code,409);
    assert.equal(e.calls.filter(x=>x.action==='start').length,0);

    r=e.response();
    await e.controller.gererAppel(e.req('POST',{action:'start',mode:'audio',transport:'webrtc',e2eeRequired:true}),r);
    assert.equal(r.result.code,409);

    r=e.response();
    await e.controller.gererAppel(e.req('POST',{action:'start',mode:'audio',transport:'livekit',e2eeRequired:true}),r);
    assert.equal(r.result.code,201);
    assert.equal(r.result.body.call.e2eeRequired,true);
    assert.equal(e.calls.filter(x=>x.action==='start').length,1);
});

test('V20 : serveur refuse jeton sans concordance E2EE', async () => {
    const e = mockServer({
        TASKLY_E2EE_TEST_DEMANDE_IDS:'123',
        TASKLY_LIVEKIT_ENABLED:'true',
        TASKLY_LIVEKIT_BROWSER_ENABLED:'true'
    });
    let r=e.response();
    await e.controller.emettreJetonLiveKit(e.req('POST',{id:e.mockCall.id}),r);
    assert.equal(r.result.code,409);
    assert.equal(e.calls.filter(x=>x.action==='livekit').length,0);

    r=e.response();
    await e.controller.emettreJetonLiveKit(e.req('POST',{id:e.mockCall.id,e2eeRequired:true}),r);
    assert.equal(r.result.code,200);
    assert.equal(r.result.body.e2eeRequired,true);
    assert.equal(r.result.body.token,'testtoken');
});

test('V20 : appels normaux V19 restent disponibles hors pilote', async () => {
    const e=mockServer({TASKLY_E2EE_TEST_DEMANDE_IDS:'999'});
    let r=e.response();
    await e.controller.gererAppel(e.req('GET'),r);
    assert.equal(r.result.code,200);
    assert.equal(r.result.body.e2eeRequired,undefined);
    r=e.response();
    await e.controller.gererAppel(e.req('POST',{action:'start',mode:'audio',transport:'livekit'}),r);
    assert.equal(r.result.code,201);
    assert.equal(r.result.body.call.e2eeRequired,undefined);
    r=e.response();
    await e.controller.gererAppel(e.req('POST',{action:'start',mode:'audio',transport:'livekit',e2eeRequired:true}),r);
    assert.equal(r.result.code,409);
});
