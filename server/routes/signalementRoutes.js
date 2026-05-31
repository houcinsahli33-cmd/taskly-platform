// Ce fichier contient les routes liées aux signalements.

const express = require("express");
const signalementController = require("../controllers/signalementController");

const { verifierConnexion } = require("../middleware/authMiddleware");

const router = express.Router();

// Créer un signalement : seulement un client connecté
router.post("/", verifierConnexion, signalementController.creerSignalement);

module.exports = router;