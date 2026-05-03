const app = require("./app"); // on importe l'application preparée dans app.js
const port = 3000; // on definit le port d'ecoute

app.listen(port, () => { // on ecoute le port
    console.log(`Serveur lancé sur http://localhost:${port}`); // on affiche un message de confirmation
});