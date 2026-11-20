'use strict';

const express = require('express');
const { timingSafeEqual } = require('node:crypto');

function creerRouteMaintenanceLiveKit({
    traiter = () => require('../services/livekitCleanupWorker')
        .traiterFermeturesLiveKit()
} = {}) {
    const router = express.Router();

    router.get('/livekit-cleanup', async (req, res) => {
        res.set('Cache-Control', 'private, no-store');

        if (process.env.TASKLY_LIVEKIT_ENABLED !== 'true' ||
            process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED !== 'true') {
            return res.status(404).end();
        }

        const secret = process.env.CRON_SECRET;
        const header = req.get('Authorization') || '';
        const token = /^Bearer ([^\s]+)$/i.exec(header)?.[1];

        if (!secret || !token) {
            return res.status(404).end();
        }

        const a = Buffer.from(secret);
        const b = Buffer.from(token);

        if (a.length !== b.length ||
            !timingSafeEqual(a, b)) {
            return res.status(404).end();
        }

        try {
            const bilan = await traiter();
            return res.json({ ok: true, bilan });
        } catch {
            console.error('Taskly LiveKit : maintenance indisponible.');
            return res.status(503).json({
                message: 'Maintenance temporairement indisponible.'
            });
        }
    });

    return router;
}

module.exports = { creerRouteMaintenanceLiveKit };
