'use strict';

const { AccessToken, TrackSource } = require('livekit-server-sdk');

const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function identifiantValide(value) {
    return /^[1-9]\d{0,9}$/.test(String(value))
        && Number(value) <= 2147483647;
}

// A appeler uniquement apres verification de la session,
// des participants autorises et de l'etat de l'appel.
async function creerJetonLiveKit({
    demandeId,
    appelId,
    role,
    profilId,
    mode
}) {
    if (!identifiantValide(demandeId) ||
        !identifiantValide(profilId) ||
        !UUID_V4.test(String(appelId)) ||
        !['client', 'artisan'].includes(role) ||
        !['audio', 'video'].includes(mode)) {
        throw new Error('LIVEKIT_CONTEXT_INVALID');
    }

    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!url || !apiKey || !apiSecret) {
        throw new Error('LIVEKIT_CONFIG_MISSING');
    }

    let adresse;

    try {
        adresse = new URL(url);
    } catch {
        throw new Error('LIVEKIT_URL_INVALID');
    }

    if (adresse.protocol !== 'wss:' ||
        !adresse.hostname ||
        adresse.username ||
        adresse.password) {
        throw new Error('LIVEKIT_URL_INVALID');
    }

    const room = `taskly-${demandeId}-${appelId}`;
    const identity = `${role}-${profilId}`;

    const accessToken = new AccessToken(
        apiKey,
        apiSecret,
        {
            identity,
            ttl: '5m'
        }
    );

    accessToken.addGrant({
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canPublishSources: mode === 'audio'
            ? [TrackSource.MICROPHONE]
            : [TrackSource.MICROPHONE, TrackSource.CAMERA]
    });

    return {
        url,
        room,
        token: await accessToken.toJwt()
    };
}

module.exports = {
    creerJetonLiveKit
};

