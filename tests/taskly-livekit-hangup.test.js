"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const ID = "550e8400-e29b-41d4-a716-446655440000";

const oldFlags = {
    livekit: process.env.TASKLY_LIVEKIT_ENABLED,
    cleanup: process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED
};

let state;

function reset() {
    process.env.TASKLY_LIVEKIT_ENABLED = "true";
    process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED = "true";

    state = {
        demande: {
            id: 304,
            client_id: 8,
            artisan_id: 9,
            statut: "acceptee",
            messagerie_bloquee: 0
        },
        client: { id: 8 },
        workerCalls: 0,
        workerFailure: false,
        result: {
            code: 200,
            call: {
                id: ID,
                state: "ended",
                livekitIssued: true
            }
        }
    };
}

reset();

const mocks = [
    ["../server/models/chatModel", {
        trouverDemande: async () => state.demande,
        participantsAppelActifs: async () => true
    }],
    ["../server/models/clientModel", {
        trouverClientParUserId: async () => state.client
    }],
    ["../server/models/artisanModel", {
        trouverArtisanParUserId: async () => ({
            id: 9,
            verification_statut: "approuve"
        })
    }],
    ["../server/services/chatCallPilot", {
        autoriseCompte: () => true,
        autoriseDemande: () => true,
        modeGeneral: () => false
    }],
    ["../server/services/chatCallService", {
        signaler: async () => state.result
    }],
    ["../server/services/livekitCleanupWorker", {
        traiterFermeturesLiveKit: async ({ limite }) => {
            assert.equal(limite, 5);
            state.workerCalls++;
            if (state.workerFailure) {
                throw new Error("SIMULATED_WORKER_FAILURE");
            }
            return { prises: 1, fermees: 1 };
        }
    }]
];

const originals = [];

for (const [name, exports] of mocks) {
    const resolved = require.resolve(name);
    originals.push([resolved, require.cache[resolved]]);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports
    };
}

const controller = require("../server/controllers/chatController");

after(() => {
    for (const [resolved, original] of originals) {
        if (original) require.cache[resolved] = original;
        else delete require.cache[resolved];
    }

    for (const [name, previous] of [
        ["TASKLY_LIVEKIT_ENABLED", oldFlags.livekit],
        ["TASKLY_LIVEKIT_CLEANUP_ENABLED", oldFlags.cleanup]
    ]) {
        if (previous === undefined) delete process.env[name];
        else process.env[name] = previous;
    }
});

async function executer() {
    const req = {
        method: "POST",
        params: { id: "304" },
        session: {
            utilisateur: { role: "client", id: 100 }
        },
        body: { action: "end", id: ID }
    };

    const res = {
        statusCode: 200,
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

    await controller.gererAppel(req, res);
    return res;
}

test("Raccrochage LiveKit : worker declenche", async () => {
    reset();
    const res = await executer();
    assert.equal(res.statusCode, 200);
    assert.equal(state.workerCalls, 1);
});

test("Ancien appel WebRTC : aucun nettoyage", async () => {
    reset();
    state.result.call.livekitIssued = false;
    await executer();
    assert.equal(state.workerCalls, 0);
});

test("Nettoyage desactive : aucun worker", async () => {
    reset();
    process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED = "false";
    await executer();
    assert.equal(state.workerCalls, 0);
});

test("Appel non termine : aucun nettoyage", async () => {
    reset();
    state.result.call.state = "accepted";
    await executer();
    assert.equal(state.workerCalls, 0);
});

test("Fin refusee : aucun nettoyage", async () => {
    reset();
    state.result.code = 409;
    await executer();
    assert.equal(state.workerCalls, 0);
});
