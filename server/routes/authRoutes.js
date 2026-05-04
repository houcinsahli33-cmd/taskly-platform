// Ce fichier contient les routes liées à l'authentification. Il définit les chemins pour l'inscription, la connexion et la déconnexion. Chaque route appelle une fonction du controller correspondant.

const express = require("express"); // on importe express pour créer les routes
const authController = require("../controllers/authController"); // on importe le controller d'authentification qui contient les fonctions liées à l'authentification

const router = express.Router(); // on cree un routeur express pour definir les routes

// route pour inscrire un nouvel utilisateur
router.post("/register", authController.inscription);

// route pour connecter un utilisateur
router.post("/login", authController.connexion);

// route pour deconnecter un utilisateur
router.post("/logout", authController.deconnexion);

// route pour recuperer l'utilisateur connecte
router.get("/me", authController.utilisateurConnecte);

module.exports = router; // on exporte le routeur