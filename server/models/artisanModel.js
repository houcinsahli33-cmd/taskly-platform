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

// L'annuaire public exclut les comptes non approuvés, bloqués ou non vérifiés.
// Les valeurs de recherche et les bornes de pagination passent par des paramètres MySQL.
function construireFiltresAnnuaire(filtres = {}) {
    const conditions = [
        "a.verification_statut = 'approuve'",
        "u.statut_compte = 'actif'",
        'u.email_verified = 1'
    ];
    const valeurs = [];
    if (filtres.serviceId) {
        conditions.push('a.service_id = ?');
        valeurs.push(filtres.serviceId);
    }
    if (filtres.wilaya) {
        const communes = obtenirCommunesWilaya(filtres.wilaya);
        const lieux = communes.length ? communes : [filtres.wilaya];
        conditions.push('(' + lieux.map(() => 'a.ville LIKE ?').join(' OR ') + ')');
        valeurs.push(...lieux.map(lieu => '%' + lieu + '%'));
    } else if (filtres.ville) {
        conditions.push('a.ville LIKE ?');
        valeurs.push('%' + filtres.ville + '%');
    }
    if (filtres.recherche) {
        conditions.push('(u.nom LIKE ? OR u.prenom LIKE ? OR s.nom LIKE ? OR a.ville LIKE ? OR a.description LIKE ?)');
        valeurs.push(...Array(5).fill('%' + filtres.recherche + '%'));
    }
    return {where: conditions.join(' AND '), valeurs};
}

async function trouverTousLesArtisans(filtres = {}, pagination = null) {
    // Compatibilité : l'annuaire ancien utilise (filtres, {page,limit}),
    // les nouveaux consommateurs peuvent utiliser ({...filtres,page,limite}).
    const paginationIntegree = !pagination && (filtres.page !== undefined || filtres.limite !== undefined || filtres.limit !== undefined);
    const options = paginationIntegree ? {
        page: Number(filtres.page) || 1,
        limit: Math.min(48, Math.max(1, Number(filtres.limite ?? filtres.limit) || 12))
    } : pagination;
    const {where, valeurs} = construireFiltresAnnuaire(filtres);
    const base = `FROM artisans a
        JOIN users u ON a.user_id = u.id
        JOIN services s ON a.service_id = s.id`;
    const select = `SELECT a.id, a.user_id, a.service_id, a.ville, a.telephone,
               a.description, a.experience, u.photo_profil, u.nom, u.prenom,
               u.email, s.nom AS service_nom,
               COALESCE(notes.moyenne_notes, 0) AS moyenne_notes,
               COALESCE(notes.total_avis, 0) AS total_avis,
               COALESCE(missions.total_demandes, 0) AS total_demandes
        ${base}
        LEFT JOIN (
            SELECT artisan_id, ROUND(AVG(note), 1) moyenne_notes,
                   COUNT(*) total_avis FROM avis GROUP BY artisan_id
        ) notes ON notes.artisan_id = a.id
        LEFT JOIN (
            SELECT artisan_id, COUNT(*) total_demandes
            FROM demandes GROUP BY artisan_id
        ) missions ON missions.artisan_id = a.id
        WHERE ${where}
        ORDER BY a.created_at DESC, a.id DESC`;
    const compteurStandard = `SELECT COUNT(*) AS total ${base} WHERE ${where}`;
    // Pour l'appel intégré, utiliser la forme complète "artisans" du SQL
    // afin de permettre aux filtres de rester valides sans alias implicite.
    const compteurIntegre = `SELECT COUNT(*) AS total FROM artisans JOIN users u ON artisans.user_id = u.id
        JOIN services s ON artisans.service_id = s.id
        WHERE ${where.replace(/\ba\./g, 'artisans.')}`;
    const compter = async () => {
        const [lignes] = await db.promise().query(paginationIntegree ? compteurIntegre : compteurStandard, valeurs);
        return Number(lignes[0]?.total || 0);
    };
    // Ancien contrat : requête liste d'abord, puis comptage.
    // Nouveau contrat : comptage d'abord, puis page demandée.
    const totalInitial = paginationIntegree ? await compter() : null;
    const page = Math.max(1, Math.floor(Number(options?.page) || 1));
    const limite = Math.min(48, Math.max(1, Math.floor(Number(options?.limit) || 12)));
    const sql = options ? select + ' LIMIT ? OFFSET ?' : select;
    const params = options ? [...valeurs, limite, (page-1)*limite] : valeurs;
    const [artisans] = await db.promise().query(sql, params);
    if (!options) return artisans;
    const total = totalInitial === null ? await compter() : totalInitial;
    return {
        artisans, total, page, limite, pages: Math.ceil(total / limite),
        limit: limite, totalPages: Math.ceil(total / limite),
        hasMore: page * limite < total
    };
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