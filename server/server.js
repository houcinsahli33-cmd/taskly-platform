// Ce fichier est le point de départ du serveur.
// Il récupère l'application Express depuis app.js,
// puis il lance le serveur sur le port défini.

const app = require("./app"); // on importe l'application preparée dans app.js
const port = process.env.PORT || 3000; // on definit le port d'ecoute

app.listen(port, "0.0.0.0", () => {
    console.log(`Serveur lancé sur le port ${port}`); // on affiche un message de reussite
});