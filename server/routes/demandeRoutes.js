// Ce fichier contient les routes liées aux demandes.
// Il définit les URLs permettant aux clients et artisans de gérer les demandes.

const express = require("express");
const demandeController = require("../controllers/demandeController");

const { verifierConnexion, verifierClient, verifierArtisan, verifierArtisanActif } = require("../middleware/authMiddleware");
const router = express.Router();

// Routes côté client
// Créer une demande
router.post("/", verifierConnexion, verifierClient, demandeController.creerDemande);

// Lister les demandes envoyées par le client connecté
router.get("/client", verifierConnexion, verifierClient, demandeController.listerDemandesClient);

// Annuler une demande encore en attente
router.put("/:id/annuler", verifierConnexion, verifierClient, demandeController.annulerDemandeClient);

// La clé de la carte est publique côté navigateur : la restreindre à l'origine Taskly et à l'API Embed.
router.get('/itineraire/config',verifierConnexion,verifierArtisan,verifierArtisanActif,(req,res)=>{
  res.set('Cache-Control','no-store, private');
  res.json({embedKey:process.env.GOOGLE_MAPS_EMBED_API_KEY||null});
});

// Routes côté artisan
// Lister les demandes reçues par l'artisan connecté
router.get("/artisan", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.listerDemandesArtisan);

// Accepter ou refuser une demande
router.put("/:id/statut", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.modifierStatutDemande);

// Annuler une demande acceptée avec un motif
router.put("/:id/annuler-artisan", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.annulerDemandeArtisan);

// Marquer une demande acceptée comme terminée
router.put("/:id/terminer", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.terminerDemande);

// Le détail est réservé au profil artisan propriétaire de la demande.
router.get("/:id/details", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.detailsArtisan);

// Confirmation e-mail : pas d'authentification requise, mais lien à usage unique.
// La protection CSRF générale reste active dans app.js.
router.post('/confirmation-lien', require('../middleware/securityMiddleware').limiter({max:8}), demandeController.confirmerDepuisEmail);
router.put('/:id/confirmer-fin', verifierConnexion, verifierClient, demandeController.confirmerFinClient);
router.put('/:id/contester-fin', verifierConnexion, verifierClient, demandeController.contesterFinClient);
module.exports = router;