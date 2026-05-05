// Ce fichier contient les requêtes SQL liées à la table artisans.
// Il sera utilisé pour créer un profil artisan et récupérer les informations des artisans.

const db = require("../config/db");

// Créer le profil d'un artisan
async function creerProfilArtisan(userId, serviceId, ville, telephone, description, experience, photo) {
    const sql = `
        INSERT INTO artisans (user_id, service_id, ville, telephone, description, experience, photo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [
        userId,
        serviceId,
        ville,
        telephone,
        description,
        experience,
        photo
    ]);

    return resultat;
}

// Récupérer tous les artisans avec leur utilisateur et leur service
// Récupérer tous les artisans avec possibilité de filtrer
async function trouverTousLesArtisans(filtres = {}) {
    let sql = `
        SELECT 
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            artisans.photo,
            artisans.created_at,
            users.nom,
            users.prenom,
            users.email,
            services.nom AS service_nom
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        WHERE 1 = 1
    `;

    const valeurs = [];

    if (filtres.serviceId) {
        sql += " AND artisans.service_id = ?";
        valeurs.push(filtres.serviceId);
    }

    if (filtres.ville) {
        sql += " AND artisans.ville LIKE ?";
        valeurs.push("%" + filtres.ville + "%");
    }

    if (filtres.recherche) {
        sql += `
            AND (
                users.nom LIKE ?
                OR users.prenom LIKE ?
                OR services.nom LIKE ?
                OR artisans.ville LIKE ?
                OR artisans.description LIKE ?
            )
        `;

        const recherche = "%" + filtres.recherche + "%";

        valeurs.push(
            recherche,
            recherche,
            recherche,
            recherche,
            recherche
        );
    }

    sql += " ORDER BY artisans.created_at DESC";

    const [resultats] = await db.promise().query(sql, valeurs);

    return resultats;
}

// Récupérer un artisan par son id avec son utilisateur et son service
async function trouverArtisanParId(id) {
    const sql = `
        SELECT 
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            artisans.photo,
            users.nom,
            users.prenom,
            users.email,
            services.nom AS service_nom
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        WHERE artisans.id = ?
    `;

    const [resultats] = await db.promise().query(sql, [id]);

    return resultats[0];
}

module.exports = {
    creerProfilArtisan,
    trouverTousLesArtisans,
    trouverArtisanParId
};