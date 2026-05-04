// Ce fichier contient les requêtes SQL liées à la table services.
// Il sera utilisé pour récupérer les catégories de services disponibles dans Taskly.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// recuperer tous les services
async function trouverTousLesServices() {
    const sql = "SELECT * FROM services"; // requete SQL pour trouver tous les services
    const [resultats] = await db.promise().query(sql); // on execute la requete et on attends et on recupere les resultats dans un tableau
    return resultats; // on retourne tous les services
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    trouverTousLesServices
};