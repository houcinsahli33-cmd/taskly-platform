'use strict';

const { obtenirClientRedis } = require('../config/sessionStore');

const SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[1], 180)
return 1
`;

function inboxKey(role, id) {
    if (!['client', 'artisan'].includes(role) ||
        !Number.isSafeInteger(Number(id)) ||
        Number(id) < 1 ||
        Number(id) > 2147483647) {
        throw new Error('Profil invalide.');
    }

    return 'taskly:call:inbox:v1:' + role + ':' + Number(id);
}

async function indexerInvitation(acces) {

    const redis = obtenirClientRedis();

    if (!redis) {
        throw new Error('Redis indisponible.');
    }

    const role = acces.role === 'client'
        ? 'artisan' : 'client';

    const profilId = role === 'artisan'
        ? acces.artisanId : acces.clientId;

    const member = [
        acces.demandeId,
        acces.clientId,
        acces.artisanId
    ].map(Number).join(':');

    const now = Date.now();

    await redis.eval(SCRIPT, {
        keys: [inboxKey(role, profilId)],
        arguments: [
            String(now),
            String(now + 120000),
            member
        ]
    });
}

async function invitations(role, profilId) {

    const redis = obtenirClientRedis();

    if (!redis) {
        throw new Error('Redis indisponible.');
    }

    const members = await redis.sendCommand([
        'ZRANGEBYSCORE',
        inboxKey(role, profilId),
        String(Date.now()),
        '+inf',
        'LIMIT', '0', '32'
    ]);

    const candidates = [];

    for (const member of members || []) {

        if (typeof member !== 'string' ||
            !/^[1-9]\d*:[1-9]\d*:[1-9]\d*$/.test(member)) {
            continue;
        }

        const [demandeId, clientId, artisanId] =
            member.split(':').map(Number);

        if (![demandeId, clientId, artisanId].every(
            n => Number.isSafeInteger(n) &&
                n > 0 && n <= 2147483647
        )) continue;

        const owner = role === 'client'
            ? clientId : artisanId;

        if (owner !== Number(profilId)) continue;

        candidates.push({
            demandeId,
            clientId,
            artisanId,
            key: 'taskly:call:v1:' + member
        });
    }

    if (!candidates.length) return [];

    const calls = await Promise.all(
        candidates.map(c => redis.get(c.key))
    );

    const result = [];

    for (let i = 0; i < candidates.length; i++) {

        if (!calls[i]) continue;

        const call = JSON.parse(calls[i]);

        if (call.state !== 'ringing' ||
            call.callerRole !== (
                role === 'client' ? 'artisan' : 'client'
            ) ||
            !['audio', 'video'].includes(call.mode) ||
            typeof call.id !== 'string') continue;

        const { demandeId, clientId, artisanId } =
            candidates[i];

        result.push({
            demandeId,
            clientId,
            artisanId,
            id: call.id,
            mode: call.mode,
            startedAt: call.startedAt
        });
    }

    return result.sort(
        (a, b) => a.startedAt - b.startedAt
    ).slice(0, 10);
}

module.exports = {
    indexerInvitation,
    invitations
};