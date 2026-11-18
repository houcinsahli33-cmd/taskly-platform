'use strict';

const crypto = require('crypto');

const {
    obtenirClientRedis
} = require('../config/sessionStore');

const FENETRE = 15 * 60 * 1000;
const MAX = 20;

// Compteur Redis atomique

const SCRIPT = `
    local count = redis.call('INCR', KEYS[1])

    if count == 1 or redis.call('PTTL', KEYS[1]) < 0 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end

    return {count, redis.call('PTTL', KEYS[1])}
`;

// Protection de l'identifiant utilisateur

function empreinte(userId) {

    const secret = process.env.SESSION_SECRET;

    if (!secret || Buffer.byteLength(secret) < 32) {
        throw new Error('Configuration de securite invalide');
    }

    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify([
            'taskly-artisan-contact',
            String(userId)
        ]))
        .digest('hex');
}

// Limitation des consultations

async function limiterCoordonneesArtisan(req, res, next) {

    res.set('Cache-Control', 'private, no-store');

    try {

        const user = req.session?.utilisateur;

        if (!user?.id) {

            return res.status(401).json({
                message: 'Vous devez être connecté.'
            });

        }

        if (user.role !== 'client') {

            return res.status(403).json({
                message: 'Accès réservé aux clients.'
            });

        }

        const redis = obtenirClientRedis();

        if (!redis) {

            return res.status(503).json({
                message: 'Service temporairement indisponible.'
            });

        }

        const cle =
            'taskly:security:artisan-contact:' +
            empreinte(user.id);

        const resultat = await redis.eval(SCRIPT, {

            keys: [cle],

            arguments: [
                String(FENETRE)
            ]

        });

        const count = Number(resultat[0]);
        const ttl = Number(resultat[1]);

        if (!Number.isSafeInteger(count) ||
            count < 1 ||
            !Number.isFinite(ttl) ||
            ttl < 0) {

            throw new Error('Compteur Redis invalide');

        }

        if (count > MAX) {

            res.set(
                'Retry-After',
                String(Math.max(1, Math.ceil(ttl / 1000)))
            );

            return res.status(429).json({

                message: 'Limite de consultations atteinte. Veuillez patienter avant de recommencer.'

            });

        }

    } catch (error) {

        console.error(
            'Taskly : protection des coordonnées indisponible.'
        );

        return res.status(503).json({

            message: 'Service temporairement indisponible.'

        });

    }

    next();
}

module.exports = {
    limiterCoordonneesArtisan
};
