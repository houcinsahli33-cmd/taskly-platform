'use strict';

const { obtenirClientRedis } =
    require('../config/sessionStore');

const { fermerSalleLiveKit } =
    require('./livekitRoomService');

const QUEUE = 'taskly:livekit:cleanup:v1';
const LEASE_MS = 120000;
const RETRY_MS = 60000;

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Reservation atomique des taches arrivees a echeance.
// En cas de crash, le bail expire et la tache revient.
const CLAIM_SCRIPT = `
local jobs = redis.call(
    'ZRANGEBYSCORE', KEYS[1],
    '-inf', ARGV[1],
    'LIMIT', 0, ARGV[3]
)

for _, job in ipairs(jobs) do
    redis.call('ZADD', KEYS[1], ARGV[2], job)
end

return jobs
`;

// Modifier une tache seulement si notre bail est
// toujours valide (un heartbeat peut l'avoir deplacee).
const MOVE_SCRIPT = `
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])

if not score or tonumber(score) ~= tonumber(ARGV[2]) then
    return 0
end

if ARGV[3] == 'remove' then
    return redis.call('ZREM', KEYS[1], ARGV[1])
end

return redis.call('ZADD', KEYS[1], ARGV[4], ARGV[1])
`;

function verifierTache(job) {
    const valide = value =>
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= 2147483647;

    if (!job ||
        !valide(job.demandeId) ||
        !valide(job.clientId) ||
        !valide(job.artisanId) ||
        !UUID.test(String(job.appelId))) {
        throw new Error('LIVEKIT_CLEANUP_JOB_INVALID');
    }
}

async function traiterFermeturesLiveKit({
    redis = obtenirClientRedis(),
    fermer = fermerSalleLiveKit,
    maintenant = Date.now,
    limite = 5
} = {}) {
    if (!redis || !redis.isReady) {
        throw new Error('LIVEKIT_REDIS_UNAVAILABLE');
    }

    if (!Number.isInteger(limite) ||
        limite < 1 || limite > 20) {
        throw new Error('LIVEKIT_CLEANUP_LIMIT_INVALID');
    }

    const debut = maintenant();
    const bail = debut + LEASE_MS;

    const jobs = await redis.eval(CLAIM_SCRIPT, {
        keys: [QUEUE],
        arguments: [
            String(debut),
            String(bail),
            String(limite)
        ]
    });

    const bilan = {
        prises: jobs.length,
        fermees: 0,
        reportees: 0,
        erreurs: 0
    };

    async function changer(job, action, date) {
        return redis.eval(MOVE_SCRIPT, {
            keys: [QUEUE],
            arguments: [
                job,
                String(bail),
                action,
                String(date)
            ]
        });
    }

    for (const texte of jobs) {
        try {
            const job = JSON.parse(texte);
            verifierTache(job);

            const callKey = 'taskly:call:v1:' +
                Number(job.demandeId) + ':' +
                Number(job.clientId) + ':' +
                Number(job.artisanId);

            const raw = await redis.get(callKey);
            const call = raw ? JSON.parse(raw) : null;

            // Ne jamais fermer une salle correspondant
            // a un appel encore accepte dans Redis.
            if (call &&
                call.id === job.appelId &&
                call.state === 'accepted') {

                await changer(
                    texte,
                    'defer',
                    maintenant() + RETRY_MS
                );

                bilan.reportees++;
                continue;
            }

            // Salle d'un appel termine, expire ou ancien.
            await fermer(job);

            await changer(texte, 'remove', 0);
            bilan.fermees++;

        } catch {
            bilan.erreurs++;

            try {
                await changer(
                    texte,
                    'retry',
                    maintenant() + RETRY_MS
                );
            } catch {
                // Le bail permet une nouvelle tentative
                // si Redis revient plus tard.
            }
        }
    }

    return bilan;
}

module.exports = {
    traiterFermeturesLiveKit
};
