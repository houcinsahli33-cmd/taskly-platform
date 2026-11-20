'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const sessionPath = require.resolve('../server/config/sessionStore');
const servicePath = require.resolve('../server/services/chatCallService');

const oldSession = require.cache[sessionPath];
const oldService = require.cache[servicePath];

const oldEnabled = process.env.TASKLY_LIVEKIT_ENABLED;
const oldBrowser = process.env.TASKLY_LIVEKIT_BROWSER_ENABLED;

const ID = '550e8400-e29b-41d4-a716-446655440000';

const acces = {
    demandeId: 304,
    role: 'client',
    clientId: 8,
    artisanId: 9
};

let last = null;
let script = '';

const redis = {
    isReady: true,
    async get() { return null; },
    async eval(lua, options) {
        script = lua;
        last = options;

        return JSON.stringify({
            code: options.arguments[0] === 'start' ? 201 : 200,
            call: { id: ID, state: 'accepted' }
        });
    }
};

require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: { obtenirClientRedis: () => redis }
};

delete require.cache[servicePath];

const { signaler } = require('../server/services/chatCallService');

function reset(enabled = true, browser = true) {
    last = null;
    process.env.TASKLY_LIVEKIT_ENABLED = String(enabled);
    process.env.TASKLY_LIVEKIT_BROWSER_ENABLED = String(browser);
}

after(() => {
    if (oldSession) require.cache[sessionPath] = oldSession;
    else delete require.cache[sessionPath];

    if (oldService) require.cache[servicePath] = oldService;
    else delete require.cache[servicePath];

    for (const [name, value] of [
        ['TASKLY_LIVEKIT_ENABLED', oldEnabled],
        ['TASKLY_LIVEKIT_BROWSER_ENABLED', oldBrowser]
    ]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
});

test('WebRTC historique conserve', async () => {
    reset(false, false);

    const result = await signaler(acces, 'start', {
        mode: 'audio',
        sdp: 'v=0\r\n'
    });

    assert.equal(result.code, 201);
    assert.equal(last.arguments[9], 'webrtc');
    assert.equal(last.arguments[4], 'v=0\r\n');
});

test('LiveKit : invitation sans SDP', async () => {
    reset();

    const result = await signaler(acces, 'start', {
        mode: 'video',
        transport: 'livekit'
    });

    assert.equal(result.code, 201);
    assert.equal(last.arguments[4], '');
    assert.equal(last.arguments[9], 'livekit');
    assert.equal(last.keys.length, 2);
});

test('LiveKit : acceptation sans SDP', async () => {
    reset();

    const result = await signaler(acces, 'accept', {
        id: ID,
        transport: 'livekit'
    });

    assert.equal(result.code, 200);
    assert.equal(last.arguments[4], '');
    assert.equal(last.arguments[9], 'livekit');
});

test('LiveKit desactive : refus', async () => {
    reset(true, false);

    const result = await signaler(acces, 'start', {
        mode: 'audio',
        transport: 'livekit'
    });

    assert.equal(result.code, 404);
    assert.equal(last, null);
});

test('WebRTC sans SDP : refus', async () => {
    reset();

    const result = await signaler(acces, 'start', {
        mode: 'audio'
    });

    assert.equal(result.code, 400);
    assert.equal(last, null);
});

test('Redis : protection contre melange des protocoles', async () => {
    reset();

    await signaler(acces, 'start', {
        mode: 'audio',
        transport: 'livekit'
    });

    assert.match(
        script,
        /\(call\.transport or 'webrtc'\) ~= ARGV\[10\]/
    );
});
