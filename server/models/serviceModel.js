// Ce fichier contient les requêtes SQL liées à la table services.
// Il sera utilisé pour récupérer les catégories de services disponibles dans Taskly.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// recuperer tous les services
async function trouverTousLesServices() {
    const sql = "SELECT * FROM services"; // requete SQL pour trouver tous les services
    const [resultats] = await db.promise().query(sql); // on execute la requete et on attends et on recupere les resultats dans un tableau
    return resultats; // on retourne tous les services
}

// recuperer un service par son id
async function trouverServiceParId(id) {
    const sql = "SELECT * FROM services WHERE id = ?";

    const [resultats] = await db.promise().query(sql, [id]);

    return resultats[0];
}

// Creer un service
async function creerService(nom, description, image) {
    const sql = `
        INSERT INTO services (nom, description, image)
        VALUES (?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [nom, description, image]);
    return resultat;
}

// Modifier un service
async function modifierService(id, nom, description, image) {
    const sql = `
        UPDATE services
        SET nom = ?, description = ?, image = ?
        WHERE id = ?
    `;
    
    const [resultat] = await db.promise().query(sql, [nom, description, image, id]);
    return resultat;
}

// Supprimer un service
async function supprimerService(id) {
    const sql = "DELETE FROM services WHERE id = ?";
    const [resultat] = await db.promise().query(sql, [id]);
    return resultat;
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    trouverTousLesServices,
    trouverServiceParId,
    creerService,
    modifierService,
    supprimerService
};