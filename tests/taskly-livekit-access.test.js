"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const CALL_ID = "550e8400-e29b-41d4-a716-446655440000";
const ancienneOption = process.env.TASKLY_LIVEKIT_ENABLED;
const ancienneOptionNavigateur =
    process.env.TASKLY_LIVEKIT_BROWSER_ENABLED;

let state;

function reset() {
    process.env.TASKLY_LIVEKIT_ENABLED = "true";
    process.env.TASKLY_LIVEKIT_BROWSER_ENABLED = "true";
    state = {
        demande: {
            id: 304,
            client_id: 8,
            artisan_id: 9,
            statut: "acceptee",
            messagerie_bloquee: 0
        },
        client: { id: 8 },
        artisan: { id: 9, verification_statut: "approuve" },
        pilote: true,
        demandeAutorisee: true,
        general: false,
        participantsActifs: true,
        redisCode: 200,
        call: {
            id: CALL_ID,
            state: "accepted",
            mode: "audio",
            transport: "livekit"
        },
        jetons: []
    };
}

reset();

const mocks = [
    ["../server/models/chatModel", {
        trouverDemande: async () => state.demande,
        participantsAppelActifs: async () => state.participantsActifs
    }],
    ["../server/models/clientModel", {
        trouverClientParUserId: async id =>
            id === 100 ? state.client : null
    }],
    ["../server/models/artisanModel", {
        trouverArtisanParUserId: async id =>
            id === 100 ? state.artisan : null
    }],
    ["../server/services/chatCallPilot", {
        autoriseCompte: (role, id) =>
            state.pilote &&
            ["client", "artisan"].includes(role) &&
            id === 100,
        autoriseDemande: () => state.demandeAutorisee,
        modeGeneral: () => state.general
    }],
    ["../server/services/chatCallService", {
        signaler: async () => ({
            code: state.redisCode,
            call: state.call
        })
    }],
    ["../server/services/livekitTokenService", {
        creerJetonLiveKit: async args => {
            state.jetons.push(args);
            return {
                url: "wss://test.livekit.invalid",
                room: "test-room",
                token: "jeton-fictif"
            };
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
    if (ancienneOption === undefined) {
        delete process.env.TASKLY_LIVEKIT_ENABLED;
    } else {
        process.env.TASKLY_LIVEKIT_ENABLED = ancienneOption;
    }
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

async function executer({
    role = "client",
    userId = 100,
    id = CALL_ID
} = {}) {
    const req = {
        params: { id: "304" },
        session: { utilisateur: { id: userId, role } },
        body: {
            id,
            role: "artisan",
            profilId: 999,
            mode: "video"
        }
    };
    const res = response();
    await controller.emettreJetonLiveKit(req, res);
    return res;
}

test("LiveKit desactive : acces refuse", async () => {
    reset();
    delete process.env.TASKLY_LIVEKIT_ENABLED;
    assert.equal((await executer()).statusCode, 404);
    assert.equal(state.jetons.length, 0);
});

test("Utilisateur inconnu : acces refuse", async () => {
    reset();
    assert.equal(
        (await executer({ userId: 999 })).statusCode,
        404
    );
});

test("Autre client : acces refuse", async () => {
    reset();
    state.client.id = 77;
    assert.equal((await executer()).statusCode, 404);
});

test("Autre artisan : acces refuse", async () => {
    reset();
    state.artisan.id = 77;
    assert.equal(
        (await executer({ role: "artisan" })).statusCode,
        404
    );
});

test("Demande non acceptee : acces refuse", async () => {
    reset();
    state.demande.statut = "en_attente";
    assert.equal((await executer()).statusCode, 403);
});

test("Messagerie bloquee : acces refuse", async () => {
    reset();
    state.demande.messagerie_bloquee = 1;
    assert.equal((await executer()).statusCode, 403);
});

test("Participant inactif : acces refuse", async () => {
    reset();
    state.general = true;
    state.participantsActifs = false;
    assert.equal((await executer()).statusCode, 403);
});

test("Identifiant invalide : acces refuse", async () => {
    reset();
    assert.equal(
        (await executer({ id: "invalid" })).statusCode,
        400
    );
});

for (const etat of ["ringing", "ended", "rejected"]) {
    test("Appel " + etat + " : aucun jeton", async () => {
        reset();
        state.call.state = etat;
        assert.equal((await executer()).statusCode, 409);
        assert.equal(state.jetons.length, 0);
    });
}

test("Mauvais identifiant d'appel : refuse", async () => {
    reset();
    state.call.id = "550e8400-e29b-41d4-a716-446655440001";
    assert.equal((await executer()).statusCode, 409);
});

test("Redis indisponible : aucun jeton", async () => {
    reset();
    state.redisCode = 503;
    assert.equal((await executer()).statusCode, 503);
    assert.equal(state.jetons.length, 0);
});

test("Appel accepte : jeton delivre au bon profil", async () => {
    reset();
    const res = await executer();

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.token, "jeton-fictif");
    assert.equal(state.jetons.length, 1);

    assert.deepEqual(state.jetons[0], {
        demandeId: 304,
        appelId: CALL_ID,
        role: "client",
        profilId: 8,
        mode: "audio"
    });
});


after(() => {
    if (ancienneOptionNavigateur === undefined) {
        delete process.env.TASKLY_LIVEKIT_BROWSER_ENABLED;
    } else {
        process.env.TASKLY_LIVEKIT_BROWSER_ENABLED =
            ancienneOptionNavigateur;
    }
});

test("WebRTC accepte : aucun jeton LiveKit", async () => {
    reset();
    state.call.transport = "webrtc";

    assert.equal((await executer()).statusCode, 409);
    assert.equal(state.jetons.length, 0);
});

test("Navigateur LiveKit desactive : aucun jeton", async () => {
    reset();
    delete process.env.TASKLY_LIVEKIT_BROWSER_ENABLED;

    assert.equal((await executer()).statusCode, 404);
    assert.equal(state.jetons.length, 0);
});
