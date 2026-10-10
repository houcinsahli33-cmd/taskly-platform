// Ce fichier contient les requêtes SQL liées aux signalements.

const db = require("../config/db");

// Recuperer une demande avec le compte utilisateur du client et l'artisan
async function trouverDemandePourSignalement(demandeId) {
    const sql = `
        SELECT
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,

            client_user.id AS client_user_id,
            client_user.nom AS client_nom,
            client_user.prenom AS client_prenom,

            artisan_user.id AS artisan_user_id,
            artisan_user.nom AS artisan_nom,
            artisan_user.prenom AS artisan_prenom
        FROM demandes
        JOIN clients ON demandes.client_id = clients.id
        JOIN users AS client_user ON clients.user_id = client_user.id
        JOIN artisans ON demandes.artisan_id = artisans.id
        JOIN users AS artisan_user ON artisans.user_id = artisan_user.id
        WHERE demandes.id = ?
    `;

    const [resultats] = await db.promise().query(sql, [demandeId]);

    return resultats[0];
}

// Creer un signalement par un client
async function creerSignalement(demandeId, signaleurUserId, signaleUserId, motif, description) {
    const sql = `
        INSERT INTO signalements (demande_id, signaleur_user_id, signale_user_id, motif, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [demandeId, signaleurUserId, signaleUserId, motif, description]);
    return resultat;
}

// Lister les signalements pour l'admin
async function listerSignalements() {
    const sql = `
        SELECT
            signalements.id,
            signalements.demande_id,
            signalements.motif,
            signalements.description,
            signalements.created_at,

            signaleur.id AS signaleur_user_id,
            signaleur.nom AS signaleur_nom,
            signaleur.prenom AS signaleur_prenom,
            signaleur.email AS signaleur_email,
            signaleur.role AS signaleur_role,

            signale.id AS signale_user_id,
            signale.nom AS signale_nom,
            signale.prenom AS signale_prenom,
            signale.email AS signale_email,
            signale.role AS signale_role,
            signale.statut_compte AS signale_statut_compte
        FROM signalements
        JOIN users AS signaleur ON signalements.signaleur_user_id = signaleur.id
        JOIN users AS signale ON signalements.signale_user_id = signale.id
        ORDER BY signalements.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql);
    return resultats;
}

module.exports = {
    trouverDemandePourSignalement,
    creerSignalement,
    listerSignalements
};