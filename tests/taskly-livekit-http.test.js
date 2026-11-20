"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const anciennesVariables = {};
const variables = [
    "TASKLY_CHAT_WORKSPACE_ENABLED",
    "TASKLY_CHAT_CALLS_ENABLED",
    "TASKLY_LIVEKIT_ENABLED"
];

for (const nom of variables) {
    anciennesVariables[nom] = process.env[nom];
    process.env[nom] = "true";
}

const anciensModules = [];

function simuler(nom, exports) {
    const chemin = require.resolve(nom);
    anciensModules.push([chemin, require.cache[chemin]]);
    require.cache[chemin] = {
        id: chemin,
        filename: chemin,
        loaded: true,
        exports
    };
}

const autreRoute = () => (req, res) =>
    res.status(501).json({ message: "Test uniquement." });

simuler("../server/controllers/demandeController",
    new Proxy({}, { get: autreRoute })
);

simuler("../server/controllers/chatController",
    new Proxy({
        emettreJetonLiveKit(req, res) {
            return res.status(200).json({
                token: "jeton-fictif",
                room: "salle-test"
            });
        }
    }, {
        get(obj, nom) {
            return obj[nom] || autreRoute();
        }
    })
);

simuler("../server/models/userModel", {
    trouverUtilisateurParId: async id => ({
        id,
        role: "client",
        statut_compte: "actif",
        email_verified: true,
        admin_session_version: 0
    })
});

const router = require("../server/routes/demandeRoutes");
let serveur;
let adresse;

before(async () => {
    const app = express();

    app.use(express.json());

    // Session fictive reservee exclusivement au test.
    app.use((req, res, next) => {
        req.session =
            req.get("X-Test-Session") === "client"
            ? {
                utilisateur: { id: 100, role: "client" },
                accountSessionVersion: 0,
                csrfToken: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            }
            : {};
        next();
    });

    app.use("/api/demandes", router);

    app.use((req, res) => {
        res.status(404).json({ message: "Route absente." });
    });

    await new Promise(resolve => {
        serveur = app.listen(0, "127.0.0.1", resolve);
    });

    adresse = "http://127.0.0.1:" +
        serveur.address().port +
        "/api/demandes/304/chat/call/livekit-token";
});

after(async () => {
    if (serveur) {
        await new Promise(resolve => serveur.close(resolve));
    }

    for (const [chemin, ancien] of anciensModules) {
        if (ancien) require.cache[chemin] = ancien;
        else delete require.cache[chemin];
    }

    for (const nom of variables) {
        if (anciennesVariables[nom] === undefined) {
            delete process.env[nom];
        } else {
            process.env[nom] = anciennesVariables[nom];
        }
    }
});

async function envoyer({ session = true, csrf = true } = {}) {
    const headers = {
        "Content-Type": "application/json"
    };

    if (session) headers["X-Test-Session"] = "client";
    if (csrf) headers["X-CSRF-Token"] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const reponse = await fetch(adresse, {
        method: "POST",
        headers,
        body: JSON.stringify({
            id: "550e8400-e29b-41d4-a716-446655440000"
        })
    });

    return {
        status: reponse.status,
        body: await reponse.json()
    };
}

test("HTTP : utilisateur non connecte refuse", async () => {
    const reponse = await envoyer({ session: false });
    assert.equal(reponse.status, 401);
});

test("HTTP : requete sans CSRF refusee", async () => {
    const reponse = await envoyer({ csrf: false });
    assert.equal(reponse.status, 403);
});

test("HTTP : requete autorisee atteint le controleur", async () => {
    const reponse = await envoyer();
    assert.equal(reponse.status, 200);
    assert.equal(reponse.body.token, "jeton-fictif");
});

test("HTTP : limitation des requetes appliquee", async () => {
    const codes = [];

    for (let i = 0; i < 11; i++) {
        codes.push((await envoyer()).status);
    }

    assert.ok(codes.includes(429));
});

