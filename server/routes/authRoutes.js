// Ce fichier contient les routes liées à l'authentification.
// Il définit les chemins pour l'inscription, la connexion et la déconnexion.
// Chaque route appelle une fonction du controller correspondant.

const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

// Route pour inscrire un nouvel utilisateur
router.post("/register", authController.inscription);
// Route pour connecter un utilisateur
router.post("/login", authController.connexion);
// Route pour déconnecter un utilisateur
router.post("/logout", authController.deconnexion); 
// Route pour vérifier si un utilisateur est connecté
router.get("/me", authController.utilisateurConnecte);

module.exports = router;