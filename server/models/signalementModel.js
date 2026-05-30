// Ce fichier contient les requêtes SQL liées aux signalements.

const db = require("../config/db");

// Créer un signalement par un client
async function creerSignalement(clientId, artisanId, motif, description) {
    const sql = `
        INSERT INTO signalements (client_id, artisan_id, motif, description)
        VALUES (?, ?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [clientId, artisanId, motif, description]);
    return resultat;
}

// Lister les signalements pour l'admin
async function listerSignalements() {
    const sql = `
        SELECT
            signalements.id,
            signalements.motif,
            signalements.description,
            signalements.created_at,

            client_user.nom AS client_nom,
            client_user.prenom AS client_prenom,
            client_user.email AS client_email,

            artisan_user.id AS artisan_user_id,
            artisan_user.nom AS artisan_nom,
            artisan_user.prenom AS artisan_prenom,
            artisan_user.email AS artisan_email,
            artisan_user.statut_compte AS artisan_statut_compte,

            artisans.id AS artisan_id,
            artisans.ville AS artisan_ville,
            services.nom AS service_nom
        FROM signalements
        JOIN clients ON signalements.client_id = clients.id
        JOIN users AS client_user ON clients.user_id = client_user.id
        JOIN artisans ON signalements.artisan_id = artisans.id
        JOIN users AS artisan_user ON artisans.user_id = artisan_user.id
        JOIN services ON artisans.service_id = services.id
        ORDER BY signalements.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql);
    return resultats;
}

module.exports = {
    creerSignalement,
    listerSignalements
};