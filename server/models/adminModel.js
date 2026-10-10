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

// Sous-ensemble des statistiques de modération : les rôles restent strictement côté serveur.
async function statistiquesVerification() {
    const [rows] = await db.promise().query(`SELECT
        COALESCE(SUM(a.verification_statut='en_attente'),0) AS enAttente,
        COALESCE(SUM(a.verification_statut='a_completer'),0) AS aCompleter,
        COALESCE(SUM(a.verification_statut='approuve'),0) AS approuves,
        COALESCE(SUM(u.statut_compte='bloque'),0) AS bloques
        FROM artisans a JOIN users u ON u.id=a.user_id WHERE u.role='artisan'`);
    return rows[0];
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

// Recuperer les derniers utilisateurs inscrits
async function derniersUtilisateurs() {
    const sql = `
        SELECT id, nom, prenom, email, role, created_at
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

// Gestion des utilisateurs : consultation complète via pages et filtres.
async function listerUtilisateurs(filtres = {}) {
    const page = Math.min(Number.isSafeInteger(Number(filtres.page)) && Number(filtres.page)>0 ? Number(filtres.page) : 1,1000000);
    const limite = Math.min(Number.isSafeInteger(Number(filtres.limite)) && Number(filtres.limite)>0 ? Number(filtres.limite) : 25,50);
    const recherche=String(filtres.recherche || '').trim().slice(0,100);
    const role=['client','artisan','admin'].includes(filtres.role) ? filtres.role : '';
    const statut=['actif','bloque'].includes(filtres.statut) ? filtres.statut : '';
    const clauses=[];const args=[];
    if(role) {clauses.push('role=?');args.push(role);}
    if(statut) {clauses.push('statut_compte=?');args.push(statut);}
    if(recherche) {
        clauses.push('(nom LIKE ? OR prenom LIKE ? OR email LIKE ?)');
        args.push(...Array(3).fill('%'+recherche+'%'));
    }
    const where=clauses.length ? 'WHERE '+clauses.join(' AND ') : '';
    const [[n]]=await db.promise().query(`SELECT COUNT(*) AS total FROM users ${where}`,args);
    const [utilisateurs]=await db.promise().query(`SELECT id,nom,prenom,email,role,statut_compte,motif_blocage,date_blocage,created_at FROM users ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,[...args,limite,(page-1)*limite]);
    const total=Number(n.total)||0;
    return {utilisateurs,total,page,limite,pages:Math.ceil(total/limite)};
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
    statistiquesVerification,
    compter,
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