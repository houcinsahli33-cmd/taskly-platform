// Ce fichier contient les routes liées à l'authentification. Il définit les chemins pour l'inscription, la connexion et la déconnexion. Chaque route appelle une fonction du controller correspondant.

const express = require("express"); // on importe express pour créer les routes
const authController = require("../controllers/authController"); // on importe le controller d'authentification qui contient les fonctions liées à l'authentification
const { verifierConnexion } = require("../middleware/authMiddleware"); // on importe le middleware pour verifier la connexion
const { uploadPhotoProfil } = require("../middleware/uploadMiddleware"); // on importe le middleware pour l'upload des photos de profil

const {limiter,csrfToken}=require('../middleware/securityMiddleware');
const router = express.Router();
router.get('/csrf',csrfToken);
const protection=limiter({max:12}); // on cree un routeur express pour definir les routes

// route pour inscrire un nouvel utilisateur
router.post("/register",protection, authController.inscription);

// route pour connecter un utilisateur
router.post("/login",protection, authController.connexion);

// route pour deconnecter un utilisateur
router.get('/pending',protection,authController.etatVerification);
router.post('/verify-email',protection,authController.confirmerEmail);
router.post('/resend-email',protection,authController.renvoyerCodeEmail);
router.post("/logout", authController.deconnexion);

// route pour recuperer l'utilisateur connecte
router.get("/me", authController.utilisateurConnecte);

// Modifier la photo de profil
router.put("/photo", verifierConnexion, uploadPhotoProfil.single("photo"), authController.modifierPhotoProfil);

// Supprimer la photo de profil
router.delete("/photo", verifierConnexion, authController.supprimerPhotoProfil);

module.exports = router; // on exporte le routeur