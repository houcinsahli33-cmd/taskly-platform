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
// Route pour récupérer tous les services
router.get("/services", verifierConnexion, verifierAdmin, adminController.listerServices);
// Route pour récupérer tous les artisans
router.get("/artisans", verifierConnexion, verifierAdmin, adminController.listerArtisans);
// Route pour ajouter un nouveau service
router.post("/services", verifierConnexion, verifierAdmin, adminController.ajouterService);
// Route pour modifier un service existant
router.put("/services/:id", verifierConnexion, verifierAdmin, adminController.modifierService);
// Route pour supprimer un service
router.delete("/services/:id", verifierConnexion, verifierAdmin, adminController.supprimerService);
module.exports = router;