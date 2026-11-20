"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const CALL_ID = "550e8400-e29b-41d4-a716-446655440000";

const acces = {
    demandeId: 304,
    clientId: 8,
    artisanId: 9,
    role: "client"
};

const captures = [];

const fauxRedis = {
    async get() {
        return JSON.stringify({
            id: CALL_ID,
            state: "accepted",
            mode: "audio"
        });
    },

    async eval(script, options) {
        captures.push({ script, options });

        return JSON.stringify({
            code: 200,
            message: "Simulation",
            call: {
                id: CALL_ID,
                state: "accepted"
            }
        });
    }
};

const storePath = require.resolve(
    "../server/config/sessionStore"
);

const ancienStore = require.cache[storePath];

require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: {
        obtenirClientRedis: () => fauxRedis
    }
};

const servicePath = require.resolve(
    "../server/services/chatCallService"
);

const ancienService = require.cache[servicePath];
delete require.cache[servicePath];

const { signaler } = require(servicePath);

after(() => {
    if (ancienStore) require.cache[storePath] = ancienStore;
    else delete require.cache[storePath];

    if (ancienService) require.cache[servicePath] = ancienService;
    else delete require.cache[servicePath];
});

test("LiveKit utilise deux cles Redis", async () => {
    captures.length = 0;

    const resultat = await signaler(
        acces, "livekit", { id: CALL_ID }
    );

    assert.equal(resultat.code, 200);
    assert.equal(captures.length, 1);

    const { script, options } = captures[0];

    assert.equal(options.keys.length, 2);
    assert.equal(
        options.keys[1],
        "taskly:livekit:cleanup:v1"
    );

    assert.match(script, /action == 'livekit'/);
    assert.match(script, /redis.call\('ZADD'/);

    console.log("OK : Raccordement LiveKit present");
});

test("Fin d'appel utilise le script Redis", async () => {
    captures.length = 0;

    const resultat = await signaler(
        acces, "end", { id: CALL_ID }
    );

    assert.equal(resultat.code, 200);
    assert.equal(captures.length, 1);
    assert.equal(captures[0].options.arguments[0], "end");

    console.log("OK : Raccrochage transmis");
});

test("Identifiant invalide refuse", async () => {
    captures.length = 0;

    const resultat = await signaler(
        acces, "livekit", { id: "invalid" }
    );

    assert.equal(resultat.code, 400);
    assert.equal(captures.length, 0);

    console.log("OK : Identifiant invalide bloque");
});

test("Lecture n'ajoute pas de fermeture", async () => {
    captures.length = 0;

    const resultat = await signaler(acces, "read");

    assert.equal(resultat.code, 200);
    assert.equal(captures.length, 0);

    console.log("OK : Lecture sans modification");
});
