'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let redis;
let operations;
let demande;
let participantsActifs;

function fake(path, exports) {
    const id = require.resolve(path);
    require.cache[id] = {
        id,
        filename: id,
        loaded: true,
        exports
    };
}

fake('../server/config/sessionStore', {
    obtenirClientRedis: () => redis
});

fake('../server/models/chatModel', {
    trouverDemande: async () => demande, participantsAppelActifs: async () => participantsActifs
});

fake('../server/models/clientModel', {
    trouverClientParUserId: async id => ({
        id: id === 42 ? 10 : 99
    })
});

fake('../server/models/artisanModel', {
    trouverArtisanParUserId: async () => ({
        id: 20,
        verification_statut: 'approuve'
    })
});

const service = require('../server/services/chatCallService');
const controller = require('../server/controllers/chatController');

const acces = {
    role: 'client',
    demandeId: 100,
    clientId: 10,
    artisanId: 20
};

beforeEach(() => {

    operations = [];

    demande = {
        id: 100,
        client_id: 10,
        artisan_id: 20,
        statut: 'acceptee'
    };

    redis = {
        get: async key => {
            operations.push({ key });
            return null;
        },
        eval: async (script, options) => {
            operations.push(options);
            return JSON.stringify({
                code: 201,
                call: {
                    id: options.arguments[2],
                    state: 'ringing'
                }
            });
        }
    };

    process.env.TASKLY_CHAT_WORKSPACE_ENABLED = 'true';
    process.env.TASKLY_CHAT_CALLS_ENABLED = 'true';
    process.env.TASKLY_CHAT_CALLS_GENERAL_ENABLED = 'false';
    participantsActifs = true;
    process.env.TASKLY_CHAT_CALLS_PILOT_CLIENT_ID = '42';
    process.env.TASKLY_CHAT_CALLS_PILOT_ARTISAN_ID = '43';
    process.env.TASKLY_CHAT_CALLS_PILOT_DEMANDE_ID = '100';
});

function response() {
    return {
        statusCode: 200,
        body: null,
        set() { return this; },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function request(userId = 42, role = 'client') {
    return {
        method: 'GET',
        params: { id: '100' },
        session: {
            utilisateur: { id: userId, role }
        }
    };
}

test('Appels : administrateur interdit', async () => {
    const result = await service.signaler({
        ...acces, role: 'admin'
    }, 'read');

    assert.equal(result.code, 403);
    assert.equal(operations.length, 0);
});

test('Appels : mode invalide refuse', async () => {
    const result = await service.signaler(acces, 'start', {
        mode: 'invalid',
        sdp: 'v=0'
    });

    assert.equal(result.code, 400);
});

test('Appels : SDP invalide refuse', async () => {
    const result = await service.signaler(acces, 'start', {
        mode: 'video',
        sdp: 'invalid'
    });

    assert.equal(result.code, 400);
});

test('Appels : SDP trop volumineux refuse', async () => {
    const result = await service.signaler(acces, 'start', {
        mode: 'video',
        sdp: 'v=0' + 'x'.repeat(25000)
    });

    assert.equal(result.code, 400);
});

test('Appels : identifiant invalide refuse', async () => {
    const result = await service.signaler(acces, 'end', {
        id: 'invalid'
    });

    assert.equal(result.code, 400);
});

test('Appels : separation des conversations Redis', async () => {
    await service.signaler(acces, 'read');

    assert.equal(
        operations[0].key,
        'taskly:call:v1:100:10:20'
    );
});

test('Appels : invitation valide transmise a Redis', async () => {
    const result = await service.signaler(acces, 'start', {
        mode: 'audio',
        sdp: 'v=0'
    });

    assert.equal(result.code, 201);
    assert.match(result.call.id, /^[0-9a-f-]{36}$/);
    assert.equal(operations[0].arguments[0], 'start');
    assert.equal(operations[0].arguments[1], 'client');
});

test('Appels : panne Redis geree', async () => {
    redis = null;

    const result = await service.signaler(acces, 'read');

    assert.equal(result.code, 503);
});

test('API appels : utilisateur etranger interdit', async () => {
    const res = response();

    await controller.gererAppel(request(99), res);

    assert.equal(res.statusCode, 404);
    assert.equal(operations.length, 0);
});

test('API appels : demande cloturee interdite', async () => {
    demande.statut = 'terminee';

    const res = response();

    await controller.gererAppel(request(), res);

    assert.equal(res.statusCode, 403);
    assert.equal(operations.length, 0);
});

test('API appels : participant autorise', async () => {
    const res = response();

    await controller.gererAppel(request(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(operations.length, 1);
});

test('API appels : fonctionnalite desactivee inaccessible', async () => {
    process.env.TASKLY_CHAT_CALLS_ENABLED = 'false';

    const res = response();

    await controller.gererAppel(request(), res);

    assert.equal(res.statusCode, 404);
    assert.equal(operations.length, 0);
});

const inbox = require('../server/services/chatCallInbox');

function invitation(overrides = {}) {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        state: 'ringing',
        callerRole: 'artisan',
        mode: 'video',
        startedAt: Date.now(),
        offer: 'v=0',
        ...overrides
    };
}

test('Notifications : index prive artisan', async () => {

    await inbox.indexerInvitation(acces);

    assert.equal(
        operations[0].keys[0],
        'taskly:call:inbox:v1:artisan:20'
    );

    assert.equal(
        operations[0].arguments[2],
        '100:10:20'
    );
});

test('Notifications : index prive client', async () => {

    await inbox.indexerInvitation({
        ...acces,
        role: 'artisan'
    });

    assert.equal(
        operations[0].keys[0],
        'taskly:call:inbox:v1:client:10'
    );
});

test('Notifications : separation des profils', async () => {

    redis.sendCommand = async () => [
        '100:10:20',
        '101:11:20',
        'invalid'
    ];

    redis.get = async key => {

        operations.push({ key });

        return JSON.stringify(invitation());
    };

    const result = await inbox.invitations('client', 10);

    assert.equal(result.length, 1);
    assert.equal(result[0].demandeId, 100);
    assert.equal(operations.length, 1);
});

test('Notifications : appels expires ignores', async () => {

    redis.sendCommand = async () => [
        '100:10:20'
    ];

    redis.get = async () => null;

    const result = await inbox.invitations('client', 10);

    assert.deepEqual(result, []);
});

test('Notifications : appels acceptes ignores', async () => {

    redis.sendCommand = async () => [
        '100:10:20'
    ];

    redis.get = async () => JSON.stringify(
        invitation({ state: 'accepted' })
    );

    const result = await inbox.invitations('client', 10);

    assert.deepEqual(result, []);
});

test('Notifications : absence de donnees SDP', async () => {

    redis.sendCommand = async () => [
        '100:10:20'
    ];

    redis.get = async () => JSON.stringify(
        invitation()
    );

    const result = await inbox.invitations('client', 10);

    assert.equal(result.length, 1);
    assert.equal(result[0].offer, undefined);
    assert.equal(result[0].answer, undefined);
});

test('Notifications : demande cloturee ignoree', async () => {

    demande.statut = 'terminee';

    redis.sendCommand = async () => [
        '100:10:20'
    ];

    redis.get = async () => JSON.stringify(
        invitation()
    );

    const res = response();

    await controller.appelsEntrants(request(), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.appels, []);
});

test('Notifications : fonctionnalite desactivee', async () => {

    process.env.TASKLY_CHAT_CALLS_ENABLED = 'false';

    const res = response();

    await controller.appelsEntrants(request(), res);

    assert.equal(res.statusCode, 404);
    assert.equal(operations.length, 0);
});
test('Pilote : autre demande interdite', async () => {

    process.env.TASKLY_CHAT_CALLS_PILOT_DEMANDE_ID = '101';

    const res = response();

    await controller.gererAppel(request(), res);

    assert.equal(res.statusCode, 404);
    assert.equal(operations.length, 0);
});

test('Pilote : autre compte artisan interdit', async () => {

    const res = response();

    await controller.gererAppel(
        request(77, 'artisan'), res
    );

    assert.equal(res.statusCode, 404);
    assert.equal(operations.length, 0);
});

test('Pilote : configuration incomplete refusee', async () => {

    delete process.env.TASKLY_CHAT_CALLS_PILOT_CLIENT_ID;

    const res = response();

    await controller.gererAppel(request(), res);

    assert.equal(res.statusCode, 404);
    assert.equal(operations.length, 0);
});
function activerGeneral() {
    process.env.TASKLY_CHAT_CALLS_GENERAL_ENABLED = 'true';
    delete process.env.TASKLY_CHAT_CALLS_PILOT_CLIENT_ID;
    delete process.env.TASKLY_CHAT_CALLS_PILOT_ARTISAN_ID;
    delete process.env.TASKLY_CHAT_CALLS_PILOT_DEMANDE_ID;
}

test('General : fonctionnement sans comptes pilotes', async () => {
    activerGeneral();
    const res = response();
    await controller.gererAppel(request(), res);
    assert.equal(res.statusCode, 200);
});

test('General : participant etranger interdit', async () => {
    activerGeneral();
    const res = response();
    await controller.gererAppel(request(99), res);
    assert.equal(res.statusCode, 404);
    assert.equal(operations.length, 0);
});

test('General : demande terminee interdite', async () => {
    activerGeneral();
    demande.statut = 'terminee';
    const res = response();
    await controller.gererAppel(request(), res);
    assert.equal(res.statusCode, 403);
});

test('General : participant non actif interdit', async () => {
    activerGeneral();
    participantsActifs = false;
    const res = response();
    await controller.gererAppel(request(), res);
    assert.equal(res.statusCode, 403);
    assert.equal(operations.length, 0);
});

test('General : administrateur interdit', async () => {
    activerGeneral();
    const res = response();
    await controller.gererAppel(request(42, 'admin'), res);
    assert.equal(res.statusCode, 404);
});

test('General : interrupteur principal prioritaire', async () => {
    activerGeneral();
    process.env.TASKLY_CHAT_CALLS_ENABLED = 'false';
    const res = response();
    await controller.gererAppel(request(), res);
    assert.equal(res.statusCode, 404);
});