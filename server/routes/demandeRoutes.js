// Ce fichier contient les routes liées aux demandes.
// Il définit les chemins pour créer une demande.

const express = require("express");
const demandeController = require("../controllers/demandeController");

const {
    verifierConnexion,
    verifierClient
} = require("../middleware/authMiddleware");

const router = express.Router();

// Route pour créer une demande
router.post("/", verifierConnexion, verifierClient, demandeController.creerDemande);


// Route pour récupérer les demandes d'un client
router.get("/client", verifierConnexion, verifierClient, demandeController.listerDemandesClient);

module.exports = router;