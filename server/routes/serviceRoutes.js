// Ce fichier contient les routes liées aux services.
// Il définit les chemins permettant de récupérer les catégories de services.

const express = require("express"); // on importe express
const serviceController = require("../controllers/serviceController");  // on importe le controller de services

const router = express.Router();    // on cree un routeur express pour definir les routes

// Route pour récupérer tous les services
router.get("/", serviceController.listerServices);

module.exports = router;