"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { traiterFermeturesLiveKit } =
    require("../server/services/livekitCleanupWorker");

const ID = "550e8400-e29b-41d4-a716-446655440000";
const NOW = 100000;

const job = {
    demandeId: 304,
    appelId: ID,
    clientId: 8,
    artisanId: 9
};

function fauxRedis(entree, score = 0, call = null) {
    const jobs = new Map();

    if (entree) {
        const texte = typeof entree === "string"
            ? entree : JSON.stringify(entree);
        jobs.set(texte, score);
    }

    return {
        isReady: true,
        jobs,

        async get() {
            return call ? JSON.stringify(call) : null;
        },

        async eval(script, options) {
            const args = options.arguments;

            if (script.includes("ZRANGEBYSCORE")) {
                const maintenant = Number(args[0]);
                const bail = Number(args[1]);
                const limite = Number(args[2]);

                const selection = [...jobs.entries()]
                    .filter(([, s]) => s <= maintenant)
                    .sort((a, b) => a[1] - b[1])
                    .slice(0, limite)
                    .map(([texte]) => texte);

                for (const texte of selection) {
                    jobs.set(texte, bail);
                }

                return selection;
            }

            if (script.includes("ZSCORE")) {
                const [texte, bail, action, date] = args;

                if (jobs.get(texte) !== Number(bail)) {
                    return 0;
                }

                if (action === "remove") {
                    jobs.delete(texte);
                    return 1;
                }

                jobs.set(texte, Number(date));
                return 1;
            }

            throw new Error("SCRIPT_INCONNU");
        }
    };
}

function options(redis, fermer, now = NOW) {
    return {
        redis,
        fermer,
        maintenant: () => now
    };
}

test("Worker : file vide", async () => {
    const redis = fauxRedis();

    const bilan = await traiterFermeturesLiveKit(
        options(redis, async () => {})
    );

    assert.deepEqual(bilan, {
        prises: 0,
        fermees: 0,
        reportees: 0,
        erreurs: 0
    });
});

test("Worker : ferme un appel termine", async () => {
    const redis = fauxRedis(job, 0, {
        id: ID,
        state: "ended"
    });

    let ferme = false;

    const bilan = await traiterFermeturesLiveKit(
        options(redis, async contexte => {
            assert.deepEqual(contexte, job);
            ferme = true;
        })
    );

    assert.equal(bilan.fermees, 1);
    assert.equal(ferme, true);
    assert.equal(redis.jobs.size, 0);
});

test("Worker : preserve un appel actif", async () => {
    const redis = fauxRedis(job, 0, {
        id: ID,
        state: "accepted"
    });

    const bilan = await traiterFermeturesLiveKit(
        options(redis, async () => {
            throw new Error("FERMETURE_INTERDITE");
        })
    );

    assert.equal(bilan.reportees, 1);
    assert.equal(bilan.erreurs, 0);
    assert.equal(redis.jobs.size, 1);
    assert.equal(
        [...redis.jobs.values()][0],
        NOW + 60000
    );
});

test("Worker : ferme une ancienne salle", async () => {
    const redis = fauxRedis(job, 0, {
        id: "550e8400-e29b-41d4-a716-446655440001",
        state: "accepted"
    });

    const bilan = await traiterFermeturesLiveKit(
        options(redis, async () => {})
    );

    assert.equal(bilan.fermees, 1);
    assert.equal(redis.jobs.size, 0);
});

test("Worker : echec puis nouvelle tentative", async () => {
    const redis = fauxRedis(job);

    const echec = await traiterFermeturesLiveKit(
        options(redis, async () => {
            throw new Error("PANNE_LIVEKIT");
        })
    );

    assert.equal(echec.erreurs, 1);
    assert.equal(echec.fermees, 0);
    assert.equal(redis.jobs.size, 1);
    assert.equal(
        [...redis.jobs.values()][0],
        NOW + 60000
    );

    const succes = await traiterFermeturesLiveKit(
        options(redis, async () => {}, NOW + 61000)
    );

    assert.equal(succes.fermees, 1);
    assert.equal(redis.jobs.size, 0);
});

test("Worker : tache invalide conservee", async () => {
    const redis = fauxRedis(
        JSON.stringify({ demandeId: 0 })
    );

    const bilan = await traiterFermeturesLiveKit(
        options(redis, async () => {
            throw new Error("NE_DOIT_PAS_FERMER");
        })
    );

    assert.equal(bilan.erreurs, 1);
    assert.equal(redis.jobs.size, 1);
});

test("Worker : Redis indisponible refuse", async () => {
    await assert.rejects(
        traiterFermeturesLiveKit({
            redis: { isReady: false }
        }),
        /LIVEKIT_REDIS_UNAVAILABLE/
    );
});
