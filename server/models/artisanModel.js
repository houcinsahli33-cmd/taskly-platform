const db = require("../config/db");
const { obtenirCommunesWilaya } = require("../helpers/algeriaLocations");

// CREATION DU PROFIL ARTISAN

async function creerProfilArtisan(
    userId, serviceId, ville,
    telephone, description, experience
) {
    const sql = `INSERT INTO artisans
        (user_id, service_id, ville, telephone,
         description, experience)
        VALUES (?, ?, ?, ?, ?, ?)`;

    const [resultat] = await db.promise().query(sql, [
        userId,
        serviceId,
        ville,
        telephone,
        description,
        experience
    ]);

    return resultat;
}

// FILTRES DE L'ANNUAIRE PUBLIC

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

        const communes = obtenirCommunesWilaya(
            filtres.wilaya
        );

        const lieux = communes.length
            ? communes
            : [filtres.wilaya];

        conditions.push(
            '(' +
            lieux.map(() => 'a.ville LIKE ?').join(' OR ') +
            ')'
        );

        valeurs.push(
            ...lieux.map(lieu => '%' + lieu + '%')
        );

    } else if (filtres.ville) {

        conditions.push('a.ville LIKE ?');
        valeurs.push('%' + filtres.ville + '%');

    }

    if (filtres.recherche) {

        conditions.push(
            '(u.nom LIKE ? OR u.prenom LIKE ? OR s.nom LIKE ? OR a.ville LIKE ? OR a.description LIKE ?)'
        );

        valeurs.push(
            ...Array(5).fill('%' + filtres.recherche + '%')
        );

    }

    return {
        where: conditions.join(' AND '),
        valeurs
    };
}

// ANNUAIRE PUBLIC DES ARTISANS

async function trouverTousLesArtisans(
    filtres = {},
    pagination = null
) {

    const paginationIntegree = !pagination && (
        filtres.page !== undefined ||
        filtres.limite !== undefined ||
        filtres.limit !== undefined
    );

    const options = paginationIntegree ? {

        page: Number(filtres.page) || 1,

        limit: Math.min(
            48,
            Math.max(
                1,
                Number(filtres.limite ?? filtres.limit) || 12
            )
        )

    } : pagination;

    const { where, valeurs } =
        construireFiltresAnnuaire(filtres);

    const base = `FROM artisans a
        JOIN users u ON a.user_id = u.id
        JOIN services s ON a.service_id = s.id`;

    // Les coordonnées privées ne sont pas
    // récupérées dans l'annuaire public.

    const select = `SELECT
               a.id,
               a.user_id,
               a.service_id,
               a.ville,
               NULL AS telephone,
               a.description,
               a.experience,
               u.photo_profil,
               u.nom,
               u.prenom,
               NULL AS email,
               s.nom AS service_nom,
               COALESCE(notes.moyenne_notes, 0) AS moyenne_notes,
               COALESCE(notes.total_avis, 0) AS total_avis,
               COALESCE(missions.total_demandes, 0) AS total_demandes
        ${base}
        LEFT JOIN (
            SELECT artisan_id,
                   ROUND(AVG(note), 1) moyenne_notes,
                   COUNT(*) total_avis
            FROM avis
            GROUP BY artisan_id
        ) notes ON notes.artisan_id = a.id
        LEFT JOIN (
            SELECT artisan_id,
                   COUNT(*) total_demandes
            FROM demandes
            GROUP BY artisan_id
        ) missions ON missions.artisan_id = a.id
        WHERE ${where}
        ORDER BY a.created_at DESC, a.id DESC`;

    const compteurStandard =
        `SELECT COUNT(*) AS total ${base} WHERE ${where}`;

    const compteurIntegre =
        `SELECT COUNT(*) AS total
         FROM artisans
         JOIN users u ON artisans.user_id = u.id
         JOIN services s ON artisans.service_id = s.id
         WHERE ${where.replace(/\ba\./g, 'artisans.')}`;

    const compter = async () => {

        const [lignes] = await db.promise().query(
            paginationIntegree
                ? compteurIntegre
                : compteurStandard,
            valeurs
        );

        return Number(lignes[0]?.total || 0);
    };

    const totalInitial =
        paginationIntegree ? await compter() : null;

    const page = Math.max(
        1,
        Math.floor(Number(options?.page) || 1)
    );

    const limite = Math.min(
        48,
        Math.max(
            1,
            Math.floor(Number(options?.limit) || 12)
        )
    );

    const sql = options
        ? select + ' LIMIT ? OFFSET ?'
        : select;

    const params = options
        ? [...valeurs, limite, (page - 1) * limite]
        : valeurs;

    const [artisans] = await db.promise().query(
        sql,
        params
    );

    if (!options) return artisans;

    const total = totalInitial === null
        ? await compter()
        : totalInitial;

    return {
        artisans,
        total,
        page,
        limite,
        pages: Math.ceil(total / limite),
        limit: limite,
        totalPages: Math.ceil(total / limite),
        hasMore: page * limite < total
    };
}

// DETAILS PUBLICS D'UN ARTISAN

async function trouverArtisanParId(id) {

    const sql = `
        SELECT
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            NULL AS telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            NULL AS email,
            services.nom AS service_nom,
            COALESCE(ROUND(AVG(avis.note), 1), 0)
                AS moyenne_notes,
            COUNT(DISTINCT avis.id)
                AS total_avis,
            COUNT(DISTINCT demandes.id)
                AS total_demandes
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        LEFT JOIN avis ON avis.artisan_id = artisans.id
        LEFT JOIN demandes
            ON demandes.artisan_id = artisans.id
        WHERE artisans.id = ?
          AND artisans.verification_statut = 'approuve'
          AND users.statut_compte = 'actif'
          AND users.email_verified = 1
        GROUP BY
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            services.nom
    `;

    const [resultats] = await db.promise().query(
        sql,
        [id]
    );

    return resultats[0];
}

// RECUPERATION DU PROFIL INTERNE

async function trouverArtisanParUserId(userId) {

    const sql =
        "SELECT * FROM artisans WHERE user_id = ?";

    const [resultats] = await db.promise().query(
        sql,
        [userId]
    );

    return resultats[0];
}

// CARTE PUBLIQUE DES ARTISANS

async function artisansPourCarte(
    filtres, lat, lon, rayon
) {

    const { where, valeurs } =
        construireFiltresAnnuaire(filtres);

    let sql = `SELECT
        a.id,
        a.ville,
        a.public_lat AS lat,
        a.public_lon AS lon,
        u.nom,
        u.prenom,
        u.photo_profil,
        s.nom AS service_nom
        FROM artisans a
        JOIN users u ON u.id = a.user_id
        JOIN services s ON s.id = a.service_id
        WHERE ${where}
        AND a.public_lat IS NOT NULL
        AND a.public_lon IS NOT NULL`;

    const params = [...valeurs];

    if (lat !== null && lon !== null) {

        const deltaLat = rayon / 111.1;

        const deltaLon = rayon / (
            111.1 * Math.max(
                0.2,
                Math.cos(lat * Math.PI / 180)
            )
        );

        sql += ` AND a.public_lat BETWEEN ? AND ?
                 AND a.public_lon BETWEEN ? AND ?`;

        params.push(
            lat - deltaLat,
            lat + deltaLat,
            lon - deltaLon,
            lon + deltaLon
        );
    }

    if (lat !== null && lon !== null) {

        sql += ` ORDER BY
            (POW(a.public_lat-?,2)
            + POW((a.public_lon-?)*?,2)) ASC,
            a.id DESC LIMIT 200`;

        params.push(
            lat,
            lon,
            Math.cos(lat * Math.PI / 180)
        );

    } else {

        sql += ' ORDER BY a.created_at DESC LIMIT 200';

    }

    const [rows] = await db.promise().query(
        sql,
        params
    );

    if (lat === null || lon === null) return rows;

    const radians = n => n * Math.PI / 180;

    return rows.map(a => {

        const dLat = radians(Number(a.lat) - lat);
        const dLon = radians(Number(a.lon) - lon);

        const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(radians(lat)) *
            Math.cos(radians(Number(a.lat))) *
            Math.sin(dLon / 2) ** 2;

        return {
            ...a,
            distanceKm: Math.round(
                6371 * 2 *
                Math.asin(Math.min(1, Math.sqrt(h))) * 10
            ) / 10
        };

    }).filter(
        a => a.distanceKm <= rayon
    ).sort(
        (a, b) => a.distanceKm - b.distanceKm
    );
}

// ENREGISTRER LA ZONE PUBLIQUE

async function enregistrerZone(userId, lat, lon) {

    const [result] = await db.promise().query(
        'UPDATE artisans SET public_lat=?,public_lon=? WHERE user_id=?',
        [
            Math.round(lat * 20) / 20,
            Math.round(lon * 20) / 20,
            userId
        ]
    );

    return result.affectedRows === 1;
}

// SUPPRIMER LA ZONE PUBLIQUE

async function supprimerZone(userId) {

    const [result] = await db.promise().query(
        'UPDATE artisans SET public_lat=NULL,public_lon=NULL WHERE user_id=?',
        [userId]
    );

    return result.affectedRows === 1;
}

async function trouverCoordonneesAutorisees(id) {

    const sql = `
        SELECT
            a.id,
            CASE
                WHEN a.afficher_telephone = 1
                THEN a.telephone
                ELSE NULL
            END AS telephone,

            CASE
                WHEN a.afficher_email = 1
                THEN a.email_professionnel
                ELSE NULL
            END AS email,

            a.autoriser_messagerie

        FROM artisans a
        JOIN users u ON a.user_id = u.id

        WHERE a.id = ?
          AND a.verification_statut = 'approuve'
          AND u.statut_compte = 'actif'
          AND u.email_verified = 1

        LIMIT 1
    `;

    const [resultats] = await db.promise().query(sql, [id]);

    return resultats[0];
}

module.exports = {
    artisansPourCarte,
    enregistrerZone,
    supprimerZone,
    creerProfilArtisan,
    trouverTousLesArtisans,
    trouverArtisanParId,
    trouverArtisanParUserId,
    trouverCoordonneesAutorisees
};
