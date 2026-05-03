// Ce fichier prépare l'application Express.
// Il contient la configuration principale du serveur : routes, middlewares,
// fichiers statiques, sessions et gestion des erreurs.
// Le serveur est lancé séparément dans server.js.

const express = require("express"); // on importe express
require("./config/db"); // on importe la configuration de la base de données

const app = express(); // on crée une application express

app.get("/", (req, res) => {    // on crée une route
    res.send("Bienvenue sur Taskly!"); // on envoie une réponse
});

module.exports = app; // on exporte l'application vers un autre fichier