// Ce fichier contient les requêtes SQL liées à la table artisans.
// Il sera utilisé pour créer un profil artisan et récupérer les informations des artisans.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// création d'un profil artisan
async function creerProfilArtisan(userId, serviceId, ville, telephone, description, experience) {
    const sql = "INSERT INTO artisans (user_id, service_id, ville, telephone, description, experience) VALUES (?, ?, ?, ?, ?, ?)"; // requete SQL pour créer un profil artisan
    const [resultat] = await db.promise().query(sql, [
        userId,
        serviceId,
        ville,
        telephone,
        description,
        experience
    ]); // on execute la requete et on attends et on recupere le resultat
    return resultat; // on retourne le resultat qui est l'id de l'artisan
}

// recuperer tous les artisans avec possibilite de filtrer
async function trouverTousLesArtisans(filtres = {}) {
    // requete qui peut changer en fonction des filtres
    let sql = `
        SELECT 
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            services.nom AS service_nom
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        -- Condition toujours vraie qui permet d'ajouter facilement d'autres conditions avec AND
        WHERE 1 = 1
    `;

    const valeurs = []; // on cree un tableau pour stocker les valeurs de filtres qui vont remplacer les ?

    // Si un serviceId est fourni, on filtre les artisans par service
    if (filtres.serviceId) {
        sql += " AND artisans.service_id = ?";  // garder seulement les artisans du service demande
        valeurs.push(filtres.serviceId);        // on ajoute la valeur correspondante dans le tableau, remplacera le "?" au moment de l'execution de la requete
    }

    // Si une ville est fournie, on filtre les artisans par ville.
    if (filtres.ville) {
        sql += " AND artisans.ville LIKE ?";
        valeurs.push("%" + filtres.ville + "%");
    }

    // Si un mot-cle de recherche est fourni, on cherche dans plusieurs colonnes.
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
        valeurs.push(recherche, recherche, recherche, recherche, recherche);    // on ajoute les valeurs de recherche dans le tableau
    }

    sql += " ORDER BY artisans.created_at DESC";    // on ajoute la condition de tri

    const [resultats] = await db.promise().query(sql, valeurs); // on execute la requete et on attends et on recupere le resultat
    return resultats;    // on retourne tous les artisans trouves
}

// Recuperer un artisan par son id avec son utilisateur et son service
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
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            services.nom AS service_nom
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        WHERE artisans.id = ?
    `; 

    const [resultats] = await db.promise().query(sql, [id]); // on execute la requete
    return resultats[0]; // on retourne l'artisan
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    creerProfilArtisan,
    trouverTousLesArtisans,
    trouverArtisanParId
};