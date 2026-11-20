'use strict';

const { RoomServiceClient } =
    require('livekit-server-sdk');

const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idValide(value) {
    return /^[1-9]\d{0,9}$/.test(String(value)) &&
        Number(value) <= 2147483647;
}

function creerClientLiveKit() {
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
        adresse.password ||
        adresse.search ||
        adresse.hash ||
        adresse.pathname !== '/') {
        throw new Error('LIVEKIT_URL_INVALID');
    }

    const host = `https://${adresse.host}`;

    return new RoomServiceClient(
        host,
        apiKey,
        apiSecret
    );
}

// Fonction interne : jamais accessible directement
// depuis une requete utilisateur non verifiee.
async function fermerSalleLiveKit({
    demandeId,
    appelId,
    clientId,
    artisanId
}) {
    if (!idValide(demandeId) ||
        !idValide(clientId) ||
        !idValide(artisanId) ||
        !UUID_V4.test(String(appelId))) {
        throw new Error('LIVEKIT_CONTEXT_INVALID');
    }

    const room = `taskly-${Number(demandeId)}-${appelId}`;
    const service = creerClientLiveKit();

    const identities = [
        `client-${Number(clientId)}`,
        `artisan-${Number(artisanId)}`
    ];

    // Timestamp en secondes : revocation LiveKit Cloud.
    const revokeTokenTs =
        BigInt(Math.floor(Date.now() / 1000));

    // Toujours tenter de retirer les deux participants.
    const removals = await Promise.allSettled(
        identities.map(identity =>
            service.removeParticipant(
                room,
                identity,
                { revokeTokenTs }
            )
        )
    );

    // Tenter la fermeture, meme si une revocation echoue.
    let deletionFailed = false;

    try {
        await service.deleteRoom(room);
    } catch {
        deletionFailed = true;
    }

    const removalFailed = removals.some(
        result => result.status === 'rejected'
    );

    if (removalFailed || deletionFailed) {
        throw new Error('LIVEKIT_CLEANUP_INCOMPLETE');
    }

    return { room, closed: true };
}

module.exports = {
    fermerSalleLiveKit
};
