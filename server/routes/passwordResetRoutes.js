'use strict';

const express = require('express');
const router = express.Router();

const passwordReset = require('../services/passwordResetService');
const { limiter } = require('../middleware/securityMiddleware');

const protectionEnvoi = limiter({
    fenetre: 15 * 60 * 1000,
    max: 5
});

const protectionVerification = limiter({
    fenetre: 15 * 60 * 1000,
    max: 12
});

const protectionReinitialisation = limiter({
    fenetre: 15 * 60 * 1000,
    max: 5
});

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// 1. DEMANDER UN CODE DE RECUPERATION

router.post('/request', protectionEnvoi, async (req, res) => {

    const { email } = req.body || {};

    if (
        typeof email !== 'string' ||
        email.trim().length > 254 ||
        !/^[^\s@<>]{1,64}@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email.trim())
    ) {
        return res.status(400).json({
            message: 'Veuillez saisir une adresse e-mail valide.'
        });
    }

    try {
        await passwordReset.demanderCode(email);
    } catch (error) {
        console.error(
            'Récupération Taskly :',
            error.code || error.name
        );
    }

    return res.status(202).json({
        message: 'Si cette adresse correspond à un compte Taskly, un code de récupération vous sera envoyé.'
    });
});

// 2. VERIFIER LE CODE

router.post('/verify', protectionVerification, async (req, res) => {

    try {
        const { email, code } = req.body || {};

        const resetToken = await passwordReset.verifierCode(
            email,
            code
        );

        if (!resetToken) {
            return res.status(400).json({
                message: 'Code incorrect, expiré ou nombre de tentatives dépassé.'
            });
        }

        return res.json({
            message: 'Code vérifié avec succès.',
            resetToken
        });

    } catch (error) {
        return res.status(error.status === 400 ? 400 : 503).json({
            message: 'Impossible de vérifier le code.'
        });
    }
});

// 3. ENREGISTRER LE NOUVEAU MOT DE PASSE

router.post('/reset', protectionReinitialisation, async (req, res) => {

    try {
        const {
            email,
            resetToken,
            nouveauMotDePasse,
            confirmation
        } = req.body || {};

        const resultat = await passwordReset.reinitialiserMotDePasse(
            email,
            resetToken,
            nouveauMotDePasse,
            confirmation
        );

        if (!resultat) {
            return res.status(400).json({
                message: 'La demande est invalide ou expirée. Veuillez recommencer.'
            });
        }

        return res.json({
            message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
        });

    } catch (error) {

        return res.status(error.status === 400 ? 400 : 503).json({
            message: error.status === 400
                ? error.message
                : 'Impossible de réinitialiser le mot de passe.'
        });
    }
});

module.exports = router;
