// Ce fichier contient les routes liées au formulaire de contact/support.

const express = require("express");
const contactController = require("../controllers/contactController");

const router = express.Router();

// Envoyer un message au support
router.post("/",contactController.envoyerMessageContact);

// Consulter l'état d'un message de contact avec id + email
router.get("/suivi",contactController.consulterMessageContact);

module.exports = router;