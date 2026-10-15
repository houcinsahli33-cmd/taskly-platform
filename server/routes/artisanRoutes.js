// Ce fichier contient les routes liées aux artisans.
// Il définit les chemins permettant de récupérer les artisans.

const express = require("express");
const artisanController = require("../controllers/artisanController");

const router = express.Router();

// La carte ne présente que des emplacements publics approximatifs.
router.get('/carte',artisanController.artisansCarte);
router.put('/ma-zone',require('../middleware/authMiddleware').verifierConnexion,
 require('../middleware/authMiddleware').verifierArtisan,artisanController.enregistrerZone);
router.delete('/ma-zone',require('../middleware/authMiddleware').verifierConnexion,
 require('../middleware/authMiddleware').verifierArtisan,artisanController.supprimerZone);
// Route pour récupérer tous les artisans
router.get("/", artisanController.listerArtisans);

// Route pour recuperer un artisan par son id
// Réponse limitée aux dates : authentification client obligatoire.
router.get('/:id/dates-indisponibles',require('../middleware/authMiddleware').verifierConnexion,
 require('../middleware/authMiddleware').verifierClient,artisanController.datesIndisponibles);
router.get("/:id", artisanController.detailArtisan);

module.exports = router;