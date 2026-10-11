// Ce fichier contient les requêtes SQL utilisées par le dashboard administrateur.

const db = require("../config/db");
const signalementModel = require("../models/signalementModel");
const contactModel = require("../models/contactModel");

// Compter les lignes d'une table
async function compter(table) {
    const tablesAutorisees = ["users", "clients", "artisans", "services", "demandes", "avis", "signalements","contacts_support"]; 
    
    // si la table donnees n'est pas autorisee, renvoyer une erreur
    if (!tablesAutorisees.includes(table)) {
        throw new Error("Table non autorisée.");
    }

    const sql = `SELECT COUNT(*) AS total FROM ${table}`; // compter le nombre de lignes de la table
    const [resultats] = await db.promise().query(sql);
    return resultats[0].total;
}

// Compter les demandes selon leur statut : en_attente, acceptee, annulee ou terminee
async function demandesParStatut() {
    const sql = `
        SELECT statut, COUNT(*) AS total
        FROM demandes
        GROUP BY statut
    `;
    const [resultats] = await db.promise().query(sql);
    return resultats;
}

// Dossiers en attente : ce sont des artisans réellement inscrits, jamais une valeur fictive.
async function compterArtisansEnAttente() {
    const [[ligne]] = await db.promise().query(
        "SELECT COUNT(*) AS total FROM artisans WHERE verification_statut = 'en_attente'"
    );
    return Number(ligne.total);
}

// Séries temporelles complètes, zéros inclus, calculées sur les inscriptions réelles.
// Les expressions SQL proviennent exclusivement de cette liste fixe, jamais de l'URL.
async function inscriptionsParPeriode(periode) {
    const periodes = {
        '7j':  {jours:7, groupe:"DATE_FORMAT(created_at, '%Y-%m-%d')", debut:'DATE_SUB(CURDATE(), INTERVAL 6 DAY)'},
        '30j': {jours:30, groupe:"DATE_FORMAT(created_at, '%Y-%m-%d')", debut:'DATE_SUB(CURDATE(), INTERVAL 29 DAY)'},
        '12m': {mois:12, groupe:"DATE_FORMAT(created_at, '%Y-%m')", debut:"DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH), '%Y-%m-01')"}
    };
    const config = periodes[periode];
    if (!config) throw new RangeError('Période invalide.');
    const [[{reference}]] = await db.promise().query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS reference");
    const [groupes] = await db.promise().query(`
        SELECT ${config.groupe} AS periode,
               SUM(CASE WHEN role = 'artisan' THEN 1 ELSE 0 END) AS artisans,
               SUM(CASE WHEN role = 'client' THEN 1 ELSE 0 END) AS clients
        FROM users
        WHERE created_at >= ${config.debut}
          AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
          AND role IN ('artisan', 'client')
        GROUP BY ${config.groupe}
        ORDER BY periode ASC
    `);
    const parPeriode = new Map(groupes.map(ligne => [ligne.periode, ligne]));
    // UTC uniquement pour manipuler les dates du calendrier sans décalage DST.
    const [annee, mois, jour] = reference.split('-').map(Number);
    const date = new Date(Date.UTC(annee, mois - 1, jour));
    const points = [];
    for (let index = (config.jours || config.mois) - 1; index >= 0; index--) {
        const d = new Date(date);
        if (config.mois) d.setUTCMonth(d.getUTCMonth() - index, 1);
        else d.setUTCDate(d.getUTCDate() - index);
        const cle = config.mois ? d.toISOString().slice(0,7) : d.toISOString().slice(0,10);
        const ligne = parPeriode.get(cle);
        points.push({periode:cle, artisans:Number(ligne?.artisans || 0), clients:Number(ligne?.clients || 0)});
    }
    return points;
}

// Recuperer les derniers utilisateurs inscrits
async function derniersUtilisateurs() {
    const sql = `
        SELECT id, nom, prenom, email, role, statut_compte, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 8
    `;
    const [resultats] = await db.promise().query(sql);
    return resultats;
}

// Recuperer les dernieres demandes
async function dernieresDemandes() {
    const sql = `
        SELECT
            demandes.id,
            demandes.statut,
            demandes.message,
            demandes.created_at,

            client_user.nom AS client_nom,
            client_user.prenom AS client_prenom,

            artisan_user.nom AS artisan_nom,
            artisan_user.prenom AS artisan_prenom,

            services.nom AS service_nom
        FROM demandes
        JOIN clients ON demandes.client_id = clients.id
        JOIN users AS client_user ON clients.user_id = client_user.id
        JOIN artisans ON demandes.artisan_id = artisans.id
        JOIN users AS artisan_user ON artisans.user_id = artisan_user.id
        JOIN services ON artisans.service_id = services.id
        ORDER BY demandes.created_at DESC
        LIMIT 8
    `;

    const [resultats] = await db.promise().query(sql);
    return resultats;
}

// Recuperer les derniers avis
async function derniersAvis() {
    const sql = `
        SELECT
            avis.id,
            avis.note,
            avis.commentaire,
            avis.created_at,

            client_user.nom AS client_nom,
            client_user.prenom AS client_prenom,

            artisan_user.nom AS artisan_nom,
            artisan_user.prenom AS artisan_prenom
        FROM avis
        JOIN clients ON avis.client_id = clients.id
        JOIN users AS client_user ON clients.user_id = client_user.id
        JOIN artisans ON avis.artisan_id = artisans.id
        JOIN users AS artisan_user ON artisans.user_id = artisan_user.id
        ORDER BY avis.created_at DESC
        LIMIT 8
    `;

    const [resultats] = await db.promise().query(sql);

    return resultats;
}

// Lister les utilisateurs de la page admin ; filtres bornés et SQL paramétré.
async function listerUtilisateurs(options = {}) {
    const jointures = `FROM users u LEFT JOIN artisans a ON a.user_id = u.id`;
    const colonnes = `u.id, u.nom, u.prenom, u.email, u.role, u.statut_compte,
      u.motif_blocage, u.date_blocage, u.created_at, a.verification_statut`;

    // Compatibilité avec l'ancien appel sans paramètres.
    if (!options.pagine) {
        const [resultats] = await db.promise().query(
            `SELECT ${colonnes} ${jointures} ORDER BY u.created_at DESC, u.id DESC`
        );
        return resultats;
    }

    const clauses = [];
    const params = [];
    if (options.recherche) {
        // Les caractères de recherche SQL sont littéraux, pas des jokers libres.
        const motif = `%${options.recherche.replace(/[\\%_]/g, '\\$&')}%`;
        clauses.push(`(CONCAT_WS(' ', u.prenom, u.nom) LIKE ? OR CONCAT_WS(' ', u.nom, u.prenom) LIKE ? OR u.email LIKE ?)`);
        params.push(motif, motif, motif);
    }
    if (options.role !== 'tous') {
        clauses.push('u.role = ?');
        params.push(options.role);
    }
    if (options.statut === 'actif' || options.statut === 'bloque') {
        clauses.push('u.statut_compte = ?');
        params.push(options.statut);
    } else if (options.statut === 'non_traite') {
        clauses.push("u.role = 'artisan' AND a.verification_statut = 'en_attente'");
    } else if (options.statut === 'nouveau') {
        clauses.push('u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    }
    const condition = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const [[{total}]] = await db.promise().query(
        `SELECT COUNT(*) AS total ${jointures}${condition}`, params
    );
    const pages = Math.max(1, Math.ceil(Number(total) / options.limite));
    const page = Math.min(options.page, pages);
    const tris = {
        recent: 'u.created_at DESC, u.id DESC',
        ancien: 'u.created_at ASC, u.id ASC',
        nom: 'u.nom ASC, u.prenom ASC, u.id ASC'
    };
    const [utilisateurs] = await db.promise().query(
        `SELECT ${colonnes} ${jointures}${condition} ORDER BY ${tris[options.tri]} LIMIT ? OFFSET ?`,
        [...params, options.limite, (page - 1) * options.limite]
    );
    return {utilisateurs, total: Number(total), page, pages, limite: options.limite};
}

// Trouver un utilisateur par son id
async function trouverUtilisateurParId(id) {
    const sql = `
        SELECT
            id,
            nom,
            prenom,
            email,
            role,
            statut_compte,
            motif_blocage,
            date_blocage
        FROM users
        WHERE id = ?
    `;

    const [resultats] = await db.promise().query(sql, [id]);

    return resultats[0];
}

// Bloquer un utilisateur
async function bloquerUtilisateur(id, motifBlocage) {
    const sql = `
        UPDATE users
        SET statut_compte = 'bloque',
            motif_blocage = ?,
            date_blocage = NOW()
        WHERE id = ?
        AND role <> 'admin'
    `;

    const [resultat] = await db.promise().query(sql, [
        motifBlocage,
        id
    ]);

    return resultat;
}

// Debloquer un utilisateur
async function debloquerUtilisateur(id) {
    const sql = `
        UPDATE users
        SET statut_compte = 'actif',
            motif_blocage = NULL,
            date_blocage = NULL
        WHERE id = ?
        AND role <> 'admin'
    `;

    const [resultat] = await db.promise().query(sql, [id]);

    return resultat;
}

module.exports = {
    compter,
    compterArtisansEnAttente,
    inscriptionsParPeriode,
    demandesParStatut,
    derniersUtilisateurs,
    dernieresDemandes,
    derniersAvis,
    listerUtilisateurs,
    trouverUtilisateurParId,
    bloquerUtilisateur,
    debloquerUtilisateur,
    listerSignalements: signalementModel.listerSignalements,
    listerMessagesContact: contactModel.listerMessagesContact,
    traiterMessageContact: contactModel.traiterMessageContact,
    derniersMessagesContact: contactModel.derniersMessagesContact
};