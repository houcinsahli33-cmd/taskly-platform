// Ce fichier contient les requêtes SQL liées à la table services.
// Il sera utilisé pour récupérer les catégories de services disponibles dans Taskly.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// recuperer tous les services
async function trouverTousLesServices() {
    const sql = `
        SELECT
            services.*,
            (
                SELECT COUNT(*)
                FROM artisans
                WHERE artisans.service_id = services.id
            ) AS total_artisans,
            (
                SELECT COUNT(*)
                FROM demandes
                JOIN artisans ON demandes.artisan_id = artisans.id
                WHERE artisans.service_id = services.id
            ) AS total_demandes,
            (
                SELECT COALESCE(ROUND(AVG(avis.note), 1), 0)
                FROM avis
                JOIN artisans ON avis.artisan_id = artisans.id
                WHERE artisans.service_id = services.id
            ) AS moyenne_notes,
            (
                SELECT COUNT(*)
                FROM avis
                JOIN artisans ON avis.artisan_id = artisans.id
                WHERE artisans.service_id = services.id
            ) AS total_avis
        FROM services
        ORDER BY services.nom ASC
    `; // requete SQL pour trouver les services avec leurs statistiques
    const [resultats] = await db.promise().query(sql); // on execute la requete et on attends et on recupere les resultats dans un tableau
    return resultats; // on retourne tous les services
}

// recuperer un service par son id
async function trouverServiceParId(id) {
    const sql = `
        SELECT
            services.*,
            (
                SELECT COUNT(*)
                FROM artisans
                WHERE artisans.service_id = services.id
            ) AS total_artisans,
            (
                SELECT COUNT(*)
                FROM demandes
                JOIN artisans ON demandes.artisan_id = artisans.id
                WHERE artisans.service_id = services.id
            ) AS total_demandes,
            (
                SELECT COALESCE(ROUND(AVG(avis.note), 1), 0)
                FROM avis
                JOIN artisans ON avis.artisan_id = artisans.id
                WHERE artisans.service_id = services.id
            ) AS moyenne_notes,
            (
                SELECT COUNT(*)
                FROM avis
                JOIN artisans ON avis.artisan_id = artisans.id
                WHERE artisans.service_id = services.id
            ) AS total_avis
        FROM services
        WHERE services.id = ?
    `;

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
