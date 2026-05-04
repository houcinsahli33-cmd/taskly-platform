// Ce fichier contient les routes liées aux services.
// Il définit les chemins permettant de récupérer les catégories de services.

const express = require("express");
const serviceController = require("../controllers/serviceController");

const router = express.Router();

// Route pour récupérer tous les services
router.get("/", serviceController.listerServices);

module.exports = router;