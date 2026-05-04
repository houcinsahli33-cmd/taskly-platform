// Ce fichier contient les requêtes SQL liées à la table artisans.
// Il sera utilisé pour créer un profil artisan et récupérer les informations des artisans.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// création d'un profil artisan
async function creerProfilArtisan(userId, serviceId, ville, telephone, description, experience, photo) {
    const sql = "INSERT INTO artisans (user_id, service_id, ville, telephone, description, experience, photo) VALUES (?, ?, ?, ?, ?, ?, ?)"; // requete SQL pour créer un profil artisan
    const [resultat] = await db.promise().query(sql, [
        userId,
        serviceId,
        ville,
        telephone,
        description,
        experience,
        photo
    ]); // on execute la requete et on attends et on recupere le resultat
    return resultat; // on retourne le resultat qui est l'id de l'artisan
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    creerProfilArtisan
};