'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { creerRouteMaintenanceLiveKit } =
    require('../server/routes/livekitMaintenanceRoutes');

const names = [
    'CRON_SECRET',
    'TASKLY_LIVEKIT_ENABLED',
    'TASKLY_LIVEKIT_CLEANUP_ENABLED'
];

const old = Object.fromEntries(
    names.map(name => [name, process.env[name]])
);

const SECRET = 'taskly-test-secret-local';
let server;
let url;
let calls = 0;
let failure = false;

before(async () => {
    process.env.CRON_SECRET = SECRET;
    process.env.TASKLY_LIVEKIT_ENABLED = 'true';
    process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED = 'true';

    const app = express();

    app.use('/api/internal', creerRouteMaintenanceLiveKit({
        traiter: async () => {
            calls++;
            if (failure) throw new Error('SIMULATED_FAILURE');
            return { prises: 1, fermees: 1 };
        }
    }));

    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', resolve);
    });

    url = 'http://127.0.0.1:' +
        server.address().port +
        '/api/internal/livekit-cleanup';
});

after(async () => {
    if (server) {
        await new Promise(resolve => server.close(resolve));
    }

    for (const name of names) {
        if (old[name] === undefined) delete process.env[name];
        else process.env[name] = old[name];
    }
});

async function envoyer(token = SECRET) {
    return fetch(url, {
        headers: token === null
            ? {}
            : { Authorization: 'Bearer ' + token }
    });
}

test('Maintenance desactivee : refusee', async () => {
    process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED = 'false';
    assert.equal((await envoyer()).status, 404);
    process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED = 'true';
});

test('Sans authentification : refusee', async () => {
    assert.equal((await envoyer(null)).status, 404);
});

test('Mauvais secret : refuse', async () => {
    assert.equal((await envoyer('incorrect')).status, 404);
});

test('Secret absent du serveur : refuse', async () => {
    delete process.env.CRON_SECRET;
    assert.equal((await envoyer()).status, 404);
    process.env.CRON_SECRET = SECRET;
});

test('Requete autorisee : worker execute', async () => {
    const avant = calls;
    const res = await envoyer();

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.ok, true);
    assert.equal(data.bilan.fermees, 1);
    assert.equal(calls, avant + 1);
});

test('Erreur worker : code 503', async () => {
    failure = true;

    const res = await envoyer();
    assert.equal(res.status, 503);

    failure = false;
});
