// Ce fichier contient les routes liées aux demandes.
// Il définit les URLs permettant aux clients et artisans de gérer les demandes.

const express = require("express");
const demandeController = require("../controllers/demandeController");

const { verifierConnexion, verifierClient, verifierArtisan } = require("../middleware/authMiddleware");
const router = express.Router();

// Routes côté client
// Créer une demande
router.post("/", verifierConnexion, verifierClient, demandeController.creerDemande);

// Lister les demandes envoyées par le client connecté
router.get("/client", verifierConnexion, verifierClient, demandeController.listerDemandesClient);

// Annuler une demande encore en attente
router.put("/:id/annuler", verifierConnexion, verifierClient, demandeController.annulerDemandeClient);

// Routes côté artisan
// Lister les demandes reçues par l'artisan connecté
router.get("/artisan", verifierConnexion, verifierArtisan, demandeController.listerDemandesArtisan);

// Accepter ou refuser une demande
router.put("/:id/statut", verifierConnexion, verifierArtisan, demandeController.modifierStatutDemande);

// Annuler une demande acceptée avec un motif
router.put("/:id/annuler-artisan", verifierConnexion, verifierArtisan, demandeController.annulerDemandeArtisan);

// Marquer une demande acceptée comme terminée
router.put("/:id/terminer", verifierConnexion, verifierArtisan, demandeController.terminerDemande);

module.exports = router;