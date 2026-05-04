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

module.exports = {
    trouverTousLesServices,
    trouverServiceParId
};