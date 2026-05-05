// Ce fichier contient les requêtes SQL liées à la table services.
// Il sera utilisé pour récupérer les catégories de services disponibles dans Taskly.

const db = require("../config/db");

// Récupérer tous les services
async function trouverTousLesServices() {
    const sql = "SELECT * FROM services";

    const [resultats] = await db.promise().query(sql);

    return resultats;
}

// Récupérer un service par son id
async function trouverServiceParId(id) {
    const sql = "SELECT * FROM services WHERE id = ?";

    const [resultats] = await db.promise().query(sql, [id]);

    return resultats[0];
}

// Ajouter un nouveau service
async function ajouterService(nom, description, image) {
    const sql = `
        INSERT INTO services (nom, description, image)
        VALUES (?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [
        nom,
        description,
        image
    ]);

    return resultat;
}

// Modifier un service
async function modifierService(id, nom, description, image) {
    const sql = `
        UPDATE services
        SET nom = ?, description = ?, image = ?
        WHERE id = ?
    `;

    const [resultat] = await db.promise().query(sql, [
        nom,
        description,
        image,
        id
    ]);

    return resultat;
}

// Supprimer un service
async function supprimerService(id) {
    const sql = "DELETE FROM services WHERE id = ?";

    const [resultat] = await db.promise().query(sql, [id]);

    return resultat;
}



module.exports = {
    trouverTousLesServices,
    trouverServiceParId,
    ajouterService,
    modifierService,
    supprimerService
};