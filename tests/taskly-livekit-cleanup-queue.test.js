"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { planifierFermetureLiveKit } =
    require("../server/services/livekitCleanupQueue");

const CALL_ID = "550e8400-e29b-41d4-a716-446655440000";

const contexte = {
    demandeId: 304,
    appelId: CALL_ID,
    clientId: 8,
    artisanId: 9
};

function fauxRedis() {
    const ajouts = [];
    const membres = new Set();

    return {
        isReady: true,
        ajouts,
        membres,

        async zAdd(cle, element, options) {
            ajouts.push({ cle, element, options });

            if (options.condition !== "NX") {
                throw new Error("NX_REQUIRED");
            }

            if (membres.has(element.value)) {
                return 0;
            }

            membres.add(element.value);
            return 1;
        }
    };
}

test("Redis : fermeture enregistree", async () => {
    const redis = fauxRedis();
    const avant = Date.now();

    const resultat = await planifierFermetureLiveKit(
        contexte, redis
    );

    const apres = Date.now();

    assert.equal(resultat.scheduled, true);
    assert.equal(redis.ajouts.length, 1);

    const entree = redis.ajouts[0];

    assert.equal(
        entree.cle,
        "taskly:livekit:cleanup:v1"
    );

    assert.equal(entree.options.condition, "NX");

    assert.ok(entree.element.score >= avant);
    assert.ok(entree.element.score <= apres);

    assert.deepEqual(
        JSON.parse(entree.element.value),
        contexte
    );
});

test("Redis : meme fermeture sans doublon", async () => {
    const redis = fauxRedis();

    await planifierFermetureLiveKit(contexte, redis);
    await planifierFermetureLiveKit(contexte, redis);

    assert.equal(redis.membres.size, 1);
});

test("Redis : deux appels distincts", async () => {
    const redis = fauxRedis();

    await planifierFermetureLiveKit(contexte, redis);

    await planifierFermetureLiveKit({
        ...contexte,
        appelId: "550e8400-e29b-41d4-a716-446655440001"
    }, redis);

    assert.equal(redis.membres.size, 2);
});

test("Redis : identifiants invalides refuses", async () => {
    const redis = fauxRedis();

    const invalides = [
        { demandeId: -1 },
        { clientId: 0 },
        { artisanId: "abc" },
        { appelId: "invalid" }
    ];

    for (const valeurs of invalides) {
        await assert.rejects(
            planifierFermetureLiveKit({
                ...contexte,
                ...valeurs
            }, redis),
            /LIVEKIT_CONTEXT_INVALID/
        );
    }

    assert.equal(redis.ajouts.length, 0);
});

test("Redis : connexion indisponible refusee", async () => {
    await assert.rejects(
        planifierFermetureLiveKit(contexte, null),
        /LIVEKIT_REDIS_UNAVAILABLE/
    );

    await assert.rejects(
        planifierFermetureLiveKit(contexte, {
            isReady: false
        }),
        /LIVEKIT_REDIS_UNAVAILABLE/
    );
});

test("Redis : echec d'ecriture signale", async () => {
    const redis = {
        isReady: true,
        async zAdd() {
            throw new Error("SIMULATED_REDIS_FAILURE");
        }
    };

    await assert.rejects(
        planifierFermetureLiveKit(contexte, redis),
        /SIMULATED_REDIS_FAILURE/
    );
});
