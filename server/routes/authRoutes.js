
const express = require("express");

const authController = require("../controllers/authController");

const { verifierConnexion } = require("../middleware/authMiddleware");

const { uploadPhotoProfil } = require("../middleware/uploadMiddleware");

const { limiter, csrfToken } = require("../middleware/securityMiddleware");

// Creation du routeur
const router = express.Router();

// Protection contre les tentatives excessives
const protection = limiter({ max: 12 });

// Recuperer le jeton de securite CSRF
router.get("/csrf", csrfToken);

// Inscription
router.post("/register", protection, require('../middleware/documentUpload').upload.single('document'), authController.inscription);

// Connexion
router.post("/login", protection, authController.connexion);

// Verification de l'adresse e-mail
router.get("/pending", protection, authController.etatVerification);
router.post("/verify-email", protection, authController.confirmerEmail);
router.post("/resend-email", protection, authController.renvoyerCodeEmail);

// Choix uniquement après mot de passe et code e-mail validés.
router.get('/spaces', protection, authController.espacesDisponibles);
router.post('/select-space', protection, authController.choisirEspace);

// Deconnexion
router.post("/logout", authController.deconnexion);

// Utilisateur connecte
router.get("/me", verifierConnexion, authController.utilisateurConnecte);
// Renouvele la session uniquement apres une interaction reelle de l’utilisateur.
router.post("/activity", verifierConnexion, require("../services/sessionActivity").confirmerActivite);

// Modifier la photo de profil
router.put(
    "/photo",
    verifierConnexion,
    uploadPhotoProfil.single("photo"),
    authController.modifierPhotoProfil
);

// Supprimer la photo de profil
router.delete(
    "/photo",
    verifierConnexion,
    authController.supprimerPhotoProfil
);

module.exports = router;
