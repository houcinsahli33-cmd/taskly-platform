
'use strict';

const express = require('express');

const {
  limiter
} = require('../middleware/securityMiddleware');

const {
  verifierConnexion,
  verifierAdmin
} = require('../middleware/authMiddleware');

const {
  genererReponse
} = require('../services/tasklyAssistantAi');

const router = express.Router();

// THEMES AUTORISES

const THEMES = new Set([
  'recherche',
  'demandes',
  'verification',
  'session',
  'support',
  'inscription'
]);

const LANGUES = new Set([
  'fr',
  'ar',
  'dz'
]);

// CONTROLE DES AUTORISATIONS

function verifierAcces(req, res, next) {

  if (req.tasklyAdminContext) {
    return verifierAdmin(req, res, next);
  }

  if (!['client', 'artisan'].includes(
    req.session?.utilisateur?.role
  )) {

    return res.status(403).json({
      message: 'Accès refusé.'
    });

  }

  next();
}

// ROUTE SECURISEE DU CHATBOT

router.post(
  '/',

  limiter({
    fenetre: 60000,
    max: 8
  }),

  verifierConnexion,
  verifierAcces,

  async (req, res) => {

    res.set(
      'Cache-Control',
      'no-store, private'
    );

    const body = req.body;

    // REFUSER LES DONNEES NON AUTORISEES

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 2 ||
      !THEMES.has(body.theme) ||
      !LANGUES.has(body.langue)
    ) {

      return res.status(400).json({
        message: 'Thème ou langue non autorisés.'
      });

    }

    // INTERROGER GROQ SANS DONNEES CLIENT

    const reponse = await genererReponse(
      body.theme,
      body.langue
    );

    if (!reponse) {

      return res.status(503).json({
        message:
          'Assistant IA momentanément indisponible.'
      });

    }

    return res.json({ reponse });

  }
);

module.exports = router;
