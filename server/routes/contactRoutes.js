// Ce fichier contient les routes liées au formulaire de contact/support.

const express = require("express");
const contactController = require("../controllers/contactController");

const router = express.Router();

// Envoyer un message au support
router.post("/",require('../middleware/securityMiddleware').limiter({max:8}),contactController.envoyerMessageContact);

// Historique des messages du seul compte client/artisan connecte.
// Les anciens messages anonymes restent consultables uniquement par numero et e-mail.
router.get('/mes-messages',require('../middleware/authMiddleware').verifierConnexion,contactController.mesMessagesSupport);

// Consulter uniquement sa propre demande et les reponses admin envoyees.
router.get('/mes-messages/:id',require('../middleware/authMiddleware').verifierConnexion,contactController.detailsMessageSupport);

// Consulter l'état d'un message de contact avec id + email
router.get("/suivi",contactController.consulterMessageContact);

module.exports = router;