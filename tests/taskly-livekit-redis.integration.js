"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createClient } = require("redis");
const path = require("node:path");

require("dotenv").config({ quiet: true });
require("dotenv").config({
    path: path.join(__dirname, "../server/.env"),
    quiet: true
});

async function main() {
    if (!process.env.REDIS_URL) {
        throw new Error("REDIS_URL absent");
    }

    const redis = createClient({
        url: process.env.REDIS_URL,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: false
        }
    });

    redis.on("error", () => {});

    const prefix = "taskly:test:livekit:" + randomUUID();
    const callKey = prefix + ":call";
    const queueKey = prefix + ":queue";

    let connected = false;

    try {
        await redis.connect();
        connected = true;

        const storePath = require.resolve(
            "../server/config/sessionStore"
        );

        require.cache[storePath] = {
            id: storePath,
            filename: storePath,
            loaded: true,
            exports: {
                obtenirClientRedis: () => ({
                    get: () => redis.get(callKey),
                    eval: (script, options) => {
                        assert.equal(options.keys.length, 2);

                        return redis.eval(script, {
                            ...options,
                            keys: [callKey, queueKey]
                        });
                    }
                })
            }
        };

        const { signaler } = require(
            "../server/services/chatCallService"
        );

        const client = {
            demandeId: 304,
            clientId: 8,
            artisanId: 9,
            role: "client"
        };

        const artisan = { ...client, role: "artisan" };

        const start = await signaler(client, "start", {
            mode: "audio",
            sdp: "v=0"
        });

        assert.equal(start.code, 201);
        const id = start.call.id;

        assert.equal(await redis.zCard(queueKey), 0);
        console.log("OK 1 : Appel cree sans fermeture");

        const accept = await signaler(artisan, "accept", {
            id,
            sdp: "v=0"
        });

        assert.equal(accept.code, 200);
        console.log("OK 2 : Appel accepte");

        const marque = await signaler(client, "livekit", {
            id
        });

        assert.equal(marque.code, 200);
        assert.equal(marque.call.livekitIssued, true);

        let jobs = await redis.zRangeWithScores(
            queueKey, 0, -1
        );

        assert.equal(jobs.length, 1);
        assert.deepEqual(JSON.parse(jobs[0].value), {
            demandeId: 304,
            appelId: id,
            clientId: 8,
            artisanId: 9
        });

        assert.ok(jobs[0].score > Date.now());

        console.log("OK 3 : Fermeture future programmee");

        const heartbeat = await signaler(
            client, "heartbeat", { id }
        );

        assert.equal(heartbeat.code, 200);
        assert.equal(heartbeat.call.state, "accepted");
        assert.equal(await redis.zCard(queueKey), 1);

        console.log("OK 4 : Presence maintenue sans doublon");

        const fin = await signaler(client, "end", {
            id
        });

        assert.equal(fin.code, 200);
        assert.equal(fin.call.state, "ended");

        jobs = await redis.zRangeWithScores(
            queueKey, 0, -1
        );

        assert.equal(jobs.length, 1);
        assert.ok(jobs[0].score <= Date.now());

        console.log("OK 5 : Fermeture immediate au raccrochage");

        const autre = await signaler(client, "start", {
            mode: "video",
            sdp: "v=0"
        });

        assert.equal(autre.code, 201);

        await signaler(artisan, "accept", {
            id: autre.call.id,
            sdp: "v=0"
        });

        await signaler(client, "end", {
            id: autre.call.id
        });

        assert.equal(await redis.zCard(queueKey), 1);

        console.log("OK 6 : WebRTC classique preserve");
        console.log("SUCCES : 6 verifications Redis reelles");

    } finally {
        if (connected) {
            try {
                await redis.del([callKey, queueKey]);
            } finally {
                redis.destroy();
            }
        } else if (redis.isOpen) {
            redis.destroy();
        }
    }
}

main().catch(error => {
    console.error("ECHEC :", error.message);
    process.exitCode = 1;
});
