'use strict';

const crypto = require('crypto');

const {
    obtenirClientRedis
} = require('../config/sessionStore');

// COMPTEUR REDIS ATOMIQUE

const SCRIPT = `
    local count = redis.call('INCR', KEYS[1])

    if count == 1 or redis.call('PTTL', KEYS[1]) < 0 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end

    return {count, redis.call('PTTL', KEYS[1])}
`;

// PROTECTION DES DONNEES CONFIDENTIELLES

function empreinte(type, valeur) {

    const secret = process.env.SESSION_SECRET;

    if (!secret || Buffer.byteLength(secret) < 32) {
        throw new Error('Configuration de securite invalide');
    }

    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify([
            'taskly-reset-limiter',
            type,
            valeur
        ]))
        .digest('hex');
}

// LIMITEUR DE REQUETES

function limiter({
    fenetre = 15 * 60 * 1000,
    max = 5
} = {}) {

    return async (req, res, next) => {

        try {

            const redis = obtenirClientRedis();

            if (!redis) {

                return res.status(503).json({
                    message: 'Service temporairement indisponible.'
                });

            }

            const ip = req.ip ||
                req.socket.remoteAddress ||
                'unknown';

            const route = req.route.path;

            const prefix =
                `taskly:security:password-reset:${route}:`;

            const cles = [
                prefix + empreinte('ip', ip)
            ];

            const email = typeof req.body?.email === 'string'
                ? req.body.email.trim().toLowerCase()
                : '';

            if (
                email.length <= 254 &&
                /^[^\s@<>]{1,64}@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)
            ) {

                cles.push(
                    prefix + empreinte('email', email)
                );

            }

            for (const cle of cles) {

                const resultat = await redis.eval(SCRIPT, {

                    keys: [cle],

                    arguments: [
                        String(fenetre)
                    ]

                });

                const count = Number(resultat[0]);
                const ttl = Number(resultat[1]);

                if (count > max) {

                    res.set(
                        'Retry-After',
                        String(Math.max(1, Math.ceil(ttl / 1000)))
                    );

                    return res.status(429).json({

                        message: 'Trop de tentatives. Veuillez patienter avant de recommencer.'

                    });

                }

            }

            next();

        } catch (error) {

            console.error(
                'Taskly : protection Redis indisponible.'
            );

            return res.status(503).json({

                message: 'Service temporairement indisponible.'

            });

        }

    };

}

module.exports = { limiter };
