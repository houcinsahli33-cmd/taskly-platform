'use strict';

const { obtenirClientRedis } =
    require('../config/sessionStore');

const QUEUE_KEY = 'taskly:livekit:cleanup:v1';

const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idValide(value) {
    return /^[1-9]\d{0,9}$/.test(String(value)) &&
        Number(value) <= 2147483647;
}

// Fonction interne : le contexte doit provenir
// des controles serveur, jamais directement du client.
async function planifierFermetureLiveKit(
    contexte,
    redisClient = obtenirClientRedis()
) {
    if (!contexte ||
        !idValide(contexte.demandeId) ||
        !idValide(contexte.clientId) ||
        !idValide(contexte.artisanId) ||
        !UUID_V4.test(String(contexte.appelId))) {
        throw new Error('LIVEKIT_CONTEXT_INVALID');
    }

    if (!redisClient || !redisClient.isReady) {
        throw new Error('LIVEKIT_REDIS_UNAVAILABLE');
    }

    const tache = {
        demandeId: Number(contexte.demandeId),
        appelId: contexte.appelId,
        clientId: Number(contexte.clientId),
        artisanId: Number(contexte.artisanId)
    };

    // NX evite de dupliquer la meme fermeture.
    // Le score conserve la date de premiere insertion.
    await redisClient.zAdd(
        QUEUE_KEY,
        {
            score: Date.now(),
            value: JSON.stringify(tache)
        },
        { condition: 'NX' }
    );

    return { scheduled: true };
}

module.exports = {
    planifierFermetureLiveKit
};
