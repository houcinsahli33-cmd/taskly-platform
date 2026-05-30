// Ce fichier prépare l'application Express. Il contient la configuration principale du serveur : routes, middlewares, fichiers statiques, sessions et gestion des erreurs.
// Le serveur est lancé séparément dans server.js.

// imports
const express = require("express");
const session = require("express-session");
const path = require("path");
require("./config/db");

const authRoutes = require("./routes/authRoutes"); //  les routes d'authentification
const serviceRoutes = require("./routes/serviceRoutes"); // les routes de services
const artisanRoutes = require("./routes/artisanRoutes"); // les routes d'artisans
const demandeRoutes = require("./routes/demandeRoutes"); // les routes de demandes
const avisRoutes = require("./routes/avisRoutes"); // les routes d'avis
const adminRoutes = require("./routes/adminRoutes"); // les routes admin
const signalementRoutes = require("./routes/signalementRoutes"); // les routes de signalements
const contactRoutes = require("./routes/contactRoutes"); // les routes de contact/support

// creation de l'application express
const app = express();

// middlewares
app.use(express.json()); // permet de lire les données JSON envoyées dans les requêtes comme req.body
app.use(express.static(path.join(__dirname, "../client/public"))); // permet de servir les fichiers statiques depuis le dossier public

app.use(session({   // Configuration des sessions utilisateur
    secret: process.env.SESSION_SECRET, // cle utilisee pour sécuriser la session
    resave: false,  // sauvegarde pas la session si elle n’a pas changee
    saveUninitialized: false,    // cree pas de session vide pour les visiteurs qui ne sont pas connectes
    cookie: {
        maxAge: 1000 * 60 * 60 * 2  // duree de validite de la session (2 heures)
    }
}))

// routes
app.use("/api/auth", authRoutes); // routes liees a l'authentification
app.use("/api/services", serviceRoutes); // routes liees aux services
app.use("/api/artisans", artisanRoutes); // routes liees aux artisans
app.use("/api/demandes", demandeRoutes); // routes liees aux demandes
app.use("/api/avis", avisRoutes); // routes liees aux avis
app.use("/api/admin", adminRoutes); // routes liees a l'administration
app.use("/api/signalements", signalementRoutes); // routes liees aux signalements
app.use("/api/contact", contactRoutes); // routes liées au contact/support

app.get("/", (req, res) => {    // on cree une route
    res.send("Bienvenue sur Taskly!"); // on envoie une réponse
});

// Middleware pour gérer les routes inexistantes
app.use((req, res) => {
  res.status(404).json({ message: "Route introuvable." });
});

module.exports = app; // on exporte l'application vers un autre fichier