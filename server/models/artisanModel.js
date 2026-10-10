// Ce fichier contient les requÃªtes SQL liÃ©es Ã  la table artisans.
// Il sera utilisÃ© pour crÃ©er un profil artisan et rÃ©cupÃ©rer les informations des artisans.

const db = require("../config/db"); // on importe la connexion Ã  la base de donnÃ©es depuis db.js
const { obtenirCommunesWilaya } = require("../helpers/algeriaLocations");

// crÃ©ation d'un profil artisan
async function creerProfilArtisan(userId, serviceId, ville, telephone, description, experience) {
    const sql = "INSERT INTO artisans (user_id, service_id, ville, telephone, description, experience) VALUES (?, ?, ?, ?, ?, ?)"; // requete SQL pour crÃ©er un profil artisan

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

// Annuaire public : ne publier que les artisans actives et approuves.
// Pagination cote serveur : aucune limite silencieuse sur le nombre total.
function construireRecherchePublique(filtres = {}) {
    const conditions = ["artisans.verification_statut = 'approuve'", "users.statut_compte = 'actif'", "users.email_verified = 1"];
    const valeurs = [];
    if (filtres.serviceId) {
        conditions.push('artisans.service_id = ?');
        valeurs.push(filtres.serviceId);
    }
    if (filtres.wilaya) {
        const communes = obtenirCommunesWilaya(filtres.wilaya);
        const lieux = communes.length ? communes : [filtres.wilaya];
        conditions.push('(' + lieux.map(() => 'artisans.ville LIKE ?').join(' OR ') + ')');
        valeurs.push(...lieux.map(v => '%' + v + '%'));
    } else if (filtres.ville) {
        conditions.push('artisans.ville LIKE ?');
        valeurs.push('%' + filtres.ville + '%');
    }
    if (filtres.recherche) {
        conditions.push('(users.nom LIKE ? OR users.prenom LIKE ? OR services.nom LIKE ? OR artisans.ville LIKE ? OR artisans.description LIKE ?)');
        valeurs.push(...Array(5).fill('%' + filtres.recherche + '%'));
    }
    return { where: conditions.join(' AND '), valeurs };
}

async function trouverTousLesArtisans(filtres = {}) {
    const {where, valeurs} = construireRecherchePublique(filtres);
    const page = Number.isSafeInteger(Number(filtres.page)) && Number(filtres.page)>0 ? Math.min(Number(filtres.page), 1000000) : 1;
    const limite = Number.isSafeInteger(Number(filtres.limite)) && Number(filtres.limite)>0 ? Math.min(Number(filtres.limite), 48) : 12;
    const offset = (page - 1) * limite;
    const jointures = `FROM artisans JOIN users ON artisans.user_id=users.id JOIN services ON artisans.service_id=services.id`;
    const [[nombre]] = await db.promise().query(`SELECT COUNT(*) AS total ${jointures} WHERE ${where}`, valeurs);
    const [artisans] = await db.promise().query(`
        SELECT artisans.id, artisans.user_id, artisans.service_id, artisans.ville,
            artisans.telephone, artisans.description, artisans.experience,
            users.photo_profil, users.nom, users.prenom, users.email,
            services.nom AS service_nom,
            (SELECT COALESCE(ROUND(AVG(note),1),0) FROM avis WHERE artisan_id=artisans.id) AS moyenne_notes,
            (SELECT COUNT(*) FROM avis WHERE artisan_id=artisans.id) AS total_avis,
            (SELECT COUNT(*) FROM demandes WHERE artisan_id=artisans.id) AS total_demandes
        ${jointures} WHERE ${where}
        ORDER BY artisans.created_at DESC, artisans.id DESC LIMIT ? OFFSET ?
    `, [...valeurs,limite,offset]);
    const total = Number(nombre.total) || 0;
    return {artisans,total,page,limite,pages:Math.ceil(total/limite)};
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
            services.nom AS service_nom,
            COALESCE(ROUND(AVG(avis.note), 1), 0) AS moyenne_notes,
            COUNT(DISTINCT avis.id) AS total_avis,
            COUNT(DISTINCT demandes.id) AS total_demandes
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        LEFT JOIN avis ON avis.artisan_id = artisans.id
        LEFT JOIN demandes ON demandes.artisan_id = artisans.id
        WHERE artisans.id = ? AND artisans.verification_statut = 'approuve' AND users.statut_compte = 'actif' AND users.email_verified = 1
        GROUP BY 
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
            services.nom
    `;

    const [resultats] = await db.promise().query(sql, [id]); // on execute la requete
    return resultats[0]; // on retourne l'artisan
}

// Recuperer un artisan a partir de son user_id
async function trouverArtisanParUserId(userId) {
    const sql = "SELECT * FROM artisans WHERE user_id = ?";

    const [resultats] = await db.promise().query(sql, [userId]);

    return resultats[0];
}

module.exports = { // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    creerProfilArtisan,
    trouverTousLesArtisans,
    trouverArtisanParId,
    trouverArtisanParUserId
};