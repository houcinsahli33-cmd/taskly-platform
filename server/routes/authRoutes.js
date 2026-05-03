// Ce fichier contient les routes liées à l'authentification. Il définit les chemins pour l'inscription, la connexion et la déconnexion. Chaque route appelle une fonction du controller correspondant.

const express = require("express"); // on importe express pour créer les routes
const authController = require("../controllers/authController"); // on importe le controller d'authentification qui contient les fonctions liées à l'authentification

const router = express.Router(); // on cree un routeur express pour definir les routes

// route pour inscrire un nouvel utilisateur
router.post("/register", authController.inscription); // on cree une route POST pour l'inscription, qui appelle la fonction inscription du controller

module.exports = router; // on exporte le routeur pour pouvoir l'utiliser dans d'autres fichiers