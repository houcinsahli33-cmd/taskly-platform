// Ce fichier contient les routes liées aux avis.

const express = require("express");
const avisController = require("../controllers/avisController");

const { verifierConnexion, verifierClient, verifierArtisan } = require("../middleware/authMiddleware");
const router = express.Router();

// Creer un avis
router.post(
    "/",
    verifierConnexion,
    verifierClient,
    avisController.creerAvis
);

// Lister les avis d'un artisan
router.get(
    "/artisan/:artisanId",
    avisController.listerAvisArtisan
);

module.exports = router;