'use strict';

require('dotenv').config({ quiet: true });

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('redis');

async function main() {

    if (!process.env.REDIS_URL) {
        console.log('REDIS_URL absent : test reel non execute.');
        process.exitCode = 1;
        return;
    }

    const redis = createClient({
        url: process.env.REDIS_URL,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: false
        }
    });

    redis.on('error', () => {});

    const key = 'taskly:test:calls:' + randomUUID();

    let connected = false;

    try {

        await redis.connect();
        connected = true;

        const store = require.resolve(
            '../server/config/sessionStore'
        );

        require.cache[store] = {
            id: store,
            filename: store,
            loaded: true,
            exports: {
                obtenirClientRedis: () => ({
                    get: () => redis.get(key),
                    eval: (script, options) => redis.eval(script, {
                        ...options,
                        keys: [key]
                    })
                })
            }
        };

        const service = require(
            '../server/services/chatCallService'
        );

        const client = {
            role: 'client',
            demandeId: 100,
            clientId: 10,
            artisanId: 20
        };

        const artisan = {
            ...client,
            role: 'artisan'
        };

        const payload = {
            mode: 'audio',
            sdp: 'v=0'
        };

        let res = await service.signaler(client, 'read');

        assert.equal(res.call, null);
        console.log('OK 1 - Etat initial vide');

        const results = await Promise.all([
            service.signaler(client, 'start', payload),
            service.signaler(artisan, 'start', payload)
        ]);

        assert.deepEqual(
            results.map(r => r.code).sort(),
            [201, 409]
        );

        const call = results.find(r => r.code === 201).call;

        const caller = call.callerRole === 'client'
            ? client : artisan;

        const receiver = call.callerRole === 'client'
            ? artisan : client;

        console.log('OK 2 - Protection appels simultanes');

        const ttl = await redis.ttl(key);

        assert.ok(ttl > 0 && ttl <= 90);
        console.log('OK 3 - Expiration invitation');

        res = await service.signaler(receiver, 'read');

        assert.equal(res.call.id, call.id);
        assert.equal(res.call.state, 'ringing');

        console.log('OK 4 - Reception invitation');

        res = await service.signaler(caller, 'accept', {
            id: call.id,
            sdp: 'v=0'
        });

        assert.equal(res.code, 409);
        console.log('OK 5 - Auto-acceptation interdite');

        res = await service.signaler(receiver, 'accept', {
            id: randomUUID(),
            sdp: 'v=0'
        });

        assert.equal(res.code, 404);
        console.log('OK 6 - Faux identifiant refuse');

        res = await service.signaler(receiver, 'accept', {
            id: call.id,
            sdp: 'v=0'
        });

        assert.equal(res.code, 200);
        assert.equal(res.call.state, 'accepted');

        console.log('OK 7 - Acceptation appel');

        res = await service.signaler(caller, 'read');

        assert.equal(res.call.state, 'accepted');
        assert.equal(res.call.answer, 'v=0');

        console.log('OK 8 - Transmission reponse');

        res = await service.signaler(caller, 'end', {
            id: call.id
        });

        assert.equal(res.call.state, 'ended');
        assert.equal(res.call.offer, undefined);
        assert.equal(res.call.answer, undefined);

        console.log('OK 9 - Fin et nettoyage des donnees');

        res = await service.signaler(client, 'start', {
            mode: 'video',
            sdp: 'v=0'
        });

        assert.equal(res.code, 201);

        res = await service.signaler(artisan, 'reject', {
            id: res.call.id
        });

        assert.equal(res.call.state, 'rejected');

        console.log('OK 10 - Refus appel video');


        function at(time, participant, action, payload) {
            const original = Date.now;

            try {
                Date.now = () => time;
                return service.signaler(participant, action, payload);
            } finally {
                Date.now = original;
            }
        }

        res = await service.signaler(client, 'start', {
            mode: 'audio',
            sdp: 'v=0'
        });

        const heartbeatId = res.call.id;

        res = await service.signaler(artisan, 'accept', {
            id: heartbeatId,
            sdp: 'v=0'
        });

        assert.equal(res.code, 200);

        const start = res.call.acceptedAt;

        const activeTtl = await redis.ttl(key);

        assert.ok(activeTtl > 0 && activeTtl <= 60);

        console.log('OK 11 - Expiration automatique');

        res = await at(start + 15000, client, 'heartbeat', {
            id: heartbeatId
        });

        assert.equal(res.code, 200);
        assert.equal(res.call.state, 'accepted');
        assert.equal(res.call.seenClient, start + 15000);

        console.log('OK 12 - Presence client');

        res = await at(start + 30000, artisan, 'heartbeat', {
            id: heartbeatId
        });

        assert.equal(res.code, 200);
        assert.equal(res.call.state, 'accepted');
        assert.equal(res.call.seenArtisan, start + 30000);

        console.log('OK 13 - Presence artisan');

        res = await at(start + 76000, client, 'heartbeat', {
            id: heartbeatId
        });

        assert.equal(res.call.state, 'ended');
        assert.equal(res.call.offer, undefined);
        assert.equal(res.call.answer, undefined);

        console.log('OK 14 - Deconnexion detectee');

        res = await service.signaler(client, 'heartbeat', {
            id: heartbeatId
        });

        assert.equal(res.code, 409);

        console.log('OK 15 - Appel termine protege');

        res = await service.signaler(client, 'start', {
            mode: 'video',
            sdp: 'v=0'
        });

        const limitId = res.call.id;

        res = await service.signaler(artisan, 'accept', {
            id: limitId,
            sdp: 'v=0'
        });

        assert.equal(res.code, 200);

        const deadline = res.call.acceptedAt + 7200000;

        const simulated = {
            ...res.call,
            seenClient: deadline - 15000,
            seenArtisan: deadline - 15000
        };

        await redis.set(
            key,
            JSON.stringify(simulated),
            { EX: 60 }
        );

        res = await at(deadline, client, 'heartbeat', {
            id: limitId
        });

        assert.equal(res.call.state, 'ended');

        console.log('OK 16 - Limite de deux heures');

        console.log('RESULTAT : 16/16 tests Redis reels.');

    } finally {

        if (connected) {
            try {
                await redis.del(key);
            } finally {
                if (redis.isOpen) redis.destroy();
            }
        } else if (redis.isOpen) {
            redis.destroy();
        }
    }
}

main().catch(error => {
    console.error(
        'Test Redis en echec :',
        error.name
    );
    process.exitCode = 1;
});