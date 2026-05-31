// Ce fichier contient les routes liées aux artisans.
// Il définit les chemins permettant de récupérer les artisans.

const express = require("express");
const artisanController = require("../controllers/artisanController");

const router = express.Router();

// Route pour récupérer tous les artisans
router.get("/", artisanController.listerArtisans);

// Route pour recuperer un artisan par son id
router.get("/:id", artisanController.detailArtisan);

module.exports = router;