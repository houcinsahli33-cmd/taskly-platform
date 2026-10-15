"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

let state;

function reset() {
    state = {
        demande: {
            id: 304,
            client_id: 8,
            artisan_id: 9,
            statut: "acceptee",
            date_traitement: "2026-10-15"
        },
        client: { id: 8 },
        artisan: { id: 9, verification_statut: "approuve" },
        envois: []
    };
}

const mocks = [
    [
        "../server/models/chatModel",
        {
            trouverDemande: async () => state.demande,
            listerMessages: async () => [
                { id: 1, contenu: "Bonjour" }
            ],
            envoyerMessage: async (...args) => {
                state.envois.push(args);
                return 50;
            }
        }
    ],
    [
        "../server/models/clientModel",
        {
            trouverClientParUserId: async () => state.client
        }
    ],
    [
        "../server/models/artisanModel",
        {
            trouverArtisanParUserId: async () => state.artisan
        }
    ]
];

const originals = [];

for (const [file, exports] of mocks) {
    const resolved = require.resolve(file);
    originals.push([resolved, require.cache[resolved]]);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports
    };
}

const controller = require("../server/controllers/chatController");

for (const [resolved, original] of originals) {
    if (original) require.cache[resolved] = original;
    else delete require.cache[resolved];
}

function request(role = "client", id = "304", contenu = "Bonjour") {
    return {
        params: { id },
        session: { utilisateur: { id: 100, role } },
        body: { contenu }
    };
}

function response() {
    return {
        statusCode: 200,
        body: null,
        headers: {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        set(name, value) {
            this.headers[name] = value;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
}

test("demande en attente : chat refuse", async () => {
    reset();
    state.demande.statut = "en_attente";
    const res = response();
    await controller.lireChat(request(), res);
    assert.equal(res.statusCode, 403);
});

test("autre client : acces interdit", async () => {
    reset();
    state.client.id = 99;
    const res = response();
    await controller.lireChat(request(), res);
    assert.equal(res.statusCode, 404);
});

test("autre artisan : acces interdit", async () => {
    reset();
    state.artisan.id = 77;
    const res = response();
    await controller.lireChat(request("artisan"), res);
    assert.equal(res.statusCode, 404);
});

test("demande acceptee : lecture autorisee", async () => {
    reset();
    const res = response();
    await controller.lireChat(request(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.demandeId, 304);
    assert.equal(res.body.lectureSeule, false);
    assert.equal(res.body.messages.length, 1);
});

test("demande acceptee : envoi autorise", async () => {
    reset();
    const res = response();
    await controller.envoyerChat(request("artisan"), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(state.envois[0], [
        304, "artisan", 9, "Bonjour"
    ]);
});

test("demande terminee : lecture seule", async () => {
    reset();
    state.demande.statut = "terminee";

    const lecture = response();
    await controller.lireChat(request(), lecture);
    assert.equal(lecture.statusCode, 200);
    assert.equal(lecture.body.lectureSeule, true);

    const envoi = response();
    await controller.envoyerChat(request(), envoi);
    assert.equal(envoi.statusCode, 403);
    assert.equal(state.envois.length, 0);
});

test("message vide ou trop long : refuse", async () => {
    reset();

    for (const contenu of ["   ", "a".repeat(4001)]) {
        const res = response();
        await controller.envoyerChat(
            request("client", "304", contenu),
            res
        );
        assert.equal(res.statusCode, 400);
    }

    assert.equal(state.envois.length, 0);
});

test("insertion SQL protegee par statut et profil", () => {
    const model = fs.readFileSync(
        path.join(__dirname, "../server/models/chatModel.js"),
        "utf8"
    );

    assert.match(model, /d\.statut = 'acceptee'/);
    assert.match(model, /d\.client_id = \?/);
    assert.match(model, /d\.artisan_id = \?/);
});