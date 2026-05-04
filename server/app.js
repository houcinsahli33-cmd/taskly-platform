// Ce fichier prépare l'application Express.
// Il contient la configuration principale du serveur : routes, middlewares, fichiers statiques, sessions et gestion des erreurs.
// Le serveur est lancé séparément dans server.js.

const express = require("express"); // on importe express pour créer l'application
const session = require("express-session"); // on importe express-session pour la gestion des sessions
require("./config/db"); // on importe la configuration de la base de données

const authRoutes = require("./routes/authRoutes"); // on importe les routes d'authentification
const serviceRoutes = require("./routes/serviceRoutes"); // on importe les routes de services
const artisanRoutes = require("./routes/artisanRoutes"); // on importe les routes d'artisans
const demandeRoutes = require("./routes/demandeRoutes");   // on importe les routes de demandes
const app = express(); // on crée une application express

app.use(express.json()); // on utilise le middleware express.json() pour analyser les requetes JSON envoyees par le client, ce qui permet de lire les corps de requetes JSON comme req.body

app.use(session({   // Configuration des sessions utilisateur
    secret: process.env.SESSION_SECRET, // la clé privee de session qui vient de .env. Elle sert à protéger le cookie de session
    resave: false,  // sauvegarde pas la session si elle n’a pas change
    saveUninitialized: false    // cree pas de session vide pour les visiteurs qui ne sont pas connectes
}))

app.use("/api/services", serviceRoutes); // on utilise le routeur de services serviceRoutes pour les routes commencant par /api/services
app.use("/api/artisans", artisanRoutes); // on utilise le routeur d'artisans artisanRoutes pour les routes commencant par /api/artisans
app.use("/api/demandes", demandeRoutes);   // on utilise le routeur de demandes demandeRoutes pour les routes commencant par /api/demandes
app.use("/api/auth", authRoutes); // on utilise le routeur d'authentification authRoutes pour les routes commencant par /api/auth

app.get("/", (req, res) => {    // on crée une route
    res.send("Bienvenue sur Taskly!"); // on envoie une réponse
});

module.exports = app; // on exporte l'application vers un autre fichier