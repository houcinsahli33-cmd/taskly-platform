'use strict';

const session = require('express-session');

let redisClient = null;

async function creerSessionStore() {

    if (process.env.REDIS_URL) {

        const { createClient } = require('redis');
        const { RedisStore } = require('connect-redis');

        const client = createClient({
            url: process.env.REDIS_URL
        });

        client.on('error', () => {
            console.error('Redis : erreur de connexion.');
        });

        await client.connect();

        redisClient = client;

        return new RedisStore({
            client,
            prefix: 'taskly:sess:'
        });
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'REDIS_URL obligatoire en production : MemoryStore interdit.'
        );
    }

    console.warn(
        'Mode local uniquement : sessions en memoire.'
    );

    return new session.MemoryStore();
}

function obtenirClientRedis() {

    if (!redisClient || !redisClient.isReady) {
        return null;
    }

    return redisClient;
}

module.exports = {
    creerSessionStore,
    obtenirClientRedis
};
