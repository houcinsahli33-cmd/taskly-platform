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

module.exports = {
    creerProfilArtisan
};