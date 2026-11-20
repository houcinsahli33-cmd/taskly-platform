"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const CALL_ID = "550e8400-e29b-41d4-a716-446655440000";

const contexte = {
    demandeId: 304,
    appelId: CALL_ID,
    clientId: 8,
    artisanId: 9
};

const nomsEnv = [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET"
];

const anciennesEnv = {};

for (const nom of nomsEnv) {
    anciennesEnv[nom] = process.env[nom];
}

let state;

function reset() {
    state = {
        connexions: [],
        retraits: [],
        suppressions: [],
        echecRetrait: null,
        echecSuppression: false
    };

    process.env.LIVEKIT_URL = "wss://test.livekit.invalid";
    process.env.LIVEKIT_API_KEY = "test-key";
    process.env.LIVEKIT_API_SECRET = "test-secret-fictif";
}

class FauxRoomServiceClient {
    constructor(host, key, secret) {
        state.connexions.push({ host, key, secret });
    }

    async removeParticipant(room, identity, options) {
        state.retraits.push({ room, identity, options });

        if (identity === state.echecRetrait) {
            throw new Error("SIMULATED_REMOVE_FAILURE");
        }
    }

    async deleteRoom(room) {
        state.suppressions.push(room);

        if (state.echecSuppression) {
            throw new Error("SIMULATED_DELETE_FAILURE");
        }
    }
}

const sdkPath = require.resolve("livekit-server-sdk");
const ancienSdk = require.cache[sdkPath];

require.cache[sdkPath] = {
    id: sdkPath,
    filename: sdkPath,
    loaded: true,
    exports: { RoomServiceClient: FauxRoomServiceClient }
};

const servicePath =
    require.resolve("../server/services/livekitRoomService");

const ancienService = require.cache[servicePath];
delete require.cache[servicePath];

const { fermerSalleLiveKit } = require(servicePath);

after(() => {
    if (ancienSdk) require.cache[sdkPath] = ancienSdk;
    else delete require.cache[sdkPath];

    if (ancienService) require.cache[servicePath] = ancienService;
    else delete require.cache[servicePath];

    for (const nom of nomsEnv) {
        if (anciennesEnv[nom] === undefined) {
            delete process.env[nom];
        } else {
            process.env[nom] = anciennesEnv[nom];
        }
    }
});

test("Salle : deux participants retires et salle fermee", async () => {
    reset();

    const resultat = await fermerSalleLiveKit(contexte);
    const salle = `taskly-304-${CALL_ID}`;

    assert.deepEqual(resultat, {
        room: salle,
        closed: true
    });

    assert.equal(state.connexions.length, 1);
    assert.equal(
        state.connexions[0].host,
        "https://test.livekit.invalid"
    );

    assert.deepEqual(
        state.retraits.map(r => r.identity).sort(),
        ["artisan-9", "client-8"]
    );

    for (const retrait of state.retraits) {
        assert.equal(retrait.room, salle);
        assert.equal(
            typeof retrait.options.revokeTokenTs,
            "bigint"
        );

        const maintenant = Math.floor(Date.now() / 1000);
        const timestamp = Number(
            retrait.options.revokeTokenTs
        );

        assert.ok(timestamp >= maintenant - 5);
        assert.ok(timestamp <= maintenant);
    }

    assert.deepEqual(state.suppressions, [salle]);
});

test("Identifiants invalides : fermeture refusee", async () => {
    reset();

    const invalides = [
        { demandeId: -1 },
        { appelId: "invalid" },
        { clientId: 0 },
        { artisanId: "inconnu" }
    ];

    for (const invalid of invalides) {
        await assert.rejects(
            fermerSalleLiveKit({
                ...contexte,
                ...invalid
            }),
            /LIVEKIT_CONTEXT_INVALID/
        );
    }

    assert.equal(state.connexions.length, 0);
});

test("Configuration absente : fermeture refusee", async () => {
    reset();
    delete process.env.LIVEKIT_API_SECRET;

    await assert.rejects(
        fermerSalleLiveKit(contexte),
        /LIVEKIT_CONFIG_MISSING/
    );

    assert.equal(state.connexions.length, 0);
});

test("URL LiveKit invalide : fermeture refusee", async () => {
    reset();

    const urls = [
        "http://test.livekit.invalid",
        "wss://user:pass@test.livekit.invalid",
        "wss://test.livekit.invalid/chemin"
    ];

    for (const url of urls) {
        process.env.LIVEKIT_URL = url;

        await assert.rejects(
            fermerSalleLiveKit(contexte),
            /LIVEKIT_URL_INVALID/
        );
    }

    assert.equal(state.connexions.length, 0);
});

test("Echec retrait : suppression quand meme tentee", async () => {
    reset();
    state.echecRetrait = "client-8";

    await assert.rejects(
        fermerSalleLiveKit(contexte),
        /LIVEKIT_CLEANUP_INCOMPLETE/
    );

    assert.equal(state.retraits.length, 2);
    assert.equal(state.suppressions.length, 1);
});

test("Echec suppression : erreur signalee", async () => {
    reset();
    state.echecSuppression = true;

    await assert.rejects(
        fermerSalleLiveKit(contexte),
        /LIVEKIT_CLEANUP_INCOMPLETE/
    );

    assert.equal(state.retraits.length, 2);
    assert.equal(state.suppressions.length, 1);
});

test("Echecs multiples : aucune fausse confirmation", async () => {
    reset();

    state.echecRetrait = "artisan-9";
    state.echecSuppression = true;

    await assert.rejects(
        fermerSalleLiveKit(contexte),
        /LIVEKIT_CLEANUP_INCOMPLETE/
    );

    assert.equal(state.retraits.length, 2);
    assert.equal(state.suppressions.length, 1);
});
