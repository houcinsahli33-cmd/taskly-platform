// Ce fichier contient les routes liées à l'administration.
// Il définit les chemins accessibles uniquement à l'administrateur.

const express = require("express");
const adminController = require("../controllers/adminController");

const {
    verifierConnexion,
    verifierAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

// Route pour récupérer tous les utilisateurs
router.get( "/users", verifierConnexion,  verifierAdmin, adminController.listerUtilisateurs);
// Route pour récupérer toutes les demandes
router.get("/demandes", verifierConnexion, verifierAdmin, adminController.listerDemandes);

module.exports = router;