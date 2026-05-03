// Ce fichier prépare l'application Express.
// Il contient la configuration principale du serveur : routes, middlewares, fichiers statiques, sessions et gestion des erreurs.
// Le serveur est lancé séparément dans server.js.

const express = require("express"); // on importe express
require("./config/db"); // on importe la configuration de la base de données

const authRoutes = require("./routes/authRoutes"); // on importe les routes d'authentification

const app = express(); // on crée une application express

app.use(express.json()); // on utilise le middleware express.json() pour analyser les requetes JSON envoyees par le client, ce qui permet de lire les corps de requetes JSON comme req.body
app.use("/api/auth", authRoutes); // on utilise le routeur d'authentification authRoutes pour les routes commencant par /api/auth

app.get("/", (req, res) => {    // on crée une route
    res.send("Bienvenue sur Taskly!"); // on envoie une réponse
});

module.exports = app; // on exporte l'application vers un autre fichier