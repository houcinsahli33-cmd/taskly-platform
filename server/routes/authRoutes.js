// Ce fichier contient les routes liées à l'authentification. Il définit les chemins pour l'inscription, la connexion et la déconnexion. Chaque route appelle une fonction du controller correspondant.

const express = require("express"); // on importe express pour créer les routes
const authController = require("../controllers/authController"); // on importe le controller d'authentification qui contient les fonctions liées à l'authentification

const router = express.Router(); // on cree un routeur express pour definir les routes

// route pour inscrire un nouvel utilisateur
router.post("/register", authController.inscription); // on cree une route POST pour l'inscription, qui appelle la fonction inscription du controller

// route pour connecter un utilisateur
router.post("/login", authController.connexion); // on cree une route POST pour la connexion, qui appelle la fonction connexion du controller

// route pour deconnecter un utilisateur
router.post("/logout", authController.deconnexion); // on cree une route POST pour la deconnexion, qui appelle la fonction deconnexion du controller

// route pour recuperer l'utilisateur connecte
router.get("/me", authController.utilisateurConnecte); // on cree une route GET pour recuperer l'utilisateur connecte, qui appelle la fonction utilisateurConnecte du controller

module.exports = router; // on exporte le routeur pour pouvoir l'utiliser dans d'autres fichiers