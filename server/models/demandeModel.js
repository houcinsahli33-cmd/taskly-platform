// Ce fichier contient les requêtes SQL liées à la table demandes.
// Il sera utilisé pour créer une demande et récupérer les demandes des clients ou des artisans.

const db = require("../config/db");

// Créer une nouvelle demande envoyée par un client à un artisan
async function creerDemande(clientId, artisanId, message, adresse, dateSouhaitee) {
    const sql = `
        INSERT INTO demandes (client_id, artisan_id, message, adresse, date_souhaitee)
        VALUES (?, ?, ?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [
        clientId,
        artisanId,
        message,
        adresse,
        dateSouhaitee
    ]);

    return resultat;
}

// Récupérer les demandes envoyées par un client
async function trouverDemandesParClient(clientId) {
    const sql = `
        SELECT 
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,
            demandes.message,
            demandes.adresse,
            demandes.date_souhaitee,
            demandes.statut,
            demandes.created_at,
            users.nom AS artisan_nom,
            users.prenom AS artisan_prenom,
            services.nom AS service_nom
        FROM demandes
        JOIN artisans ON demandes.artisan_id = artisans.id
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        WHERE demandes.client_id = ?
        ORDER BY demandes.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql, [clientId]);

    return resultats;
}

// Récupérer les demandes reçues par un artisan
async function trouverDemandesParArtisan(artisanUserId) {
    const sql = `
        SELECT 
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,
            demandes.message,
            demandes.adresse,
            demandes.date_souhaitee,
            demandes.statut,
            demandes.created_at,
            users.nom AS client_nom,
            users.prenom AS client_prenom
        FROM demandes
        JOIN users ON demandes.client_id = users.id
        JOIN artisans ON demandes.artisan_id = artisans.id
        WHERE artisans.user_id = ?
        ORDER BY demandes.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql, [artisanUserId]);

    return resultats;
}
// Modifier le statut d'une demande
async function modifierStatutDemande(demandeId, statut) {
    const sql = `
        UPDATE demandes
        SET statut = ?
        WHERE id = ?
    `;

    const [resultat] = await db.promise().query(sql, [
        statut,
        demandeId
    ]);

    return resultat;
}

// Récupérer toutes les demandes pour l'administrateur
async function trouverToutesLesDemandesParAdmin() {
    const sql = `
        SELECT 
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,
            demandes.message,
            demandes.adresse,
            demandes.date_souhaitee,
            demandes.statut,
            demandes.created_at,
            client.nom AS client_nom,
            client.prenom AS client_prenom,
            artisan_user.nom AS artisan_nom,
            artisan_user.prenom AS artisan_prenom,
            services.nom AS service_nom
        FROM demandes
        JOIN users AS client ON demandes.client_id = client.id
        JOIN artisans ON demandes.artisan_id = artisans.id
        JOIN users AS artisan_user ON artisans.user_id = artisan_user.id
        JOIN services ON artisans.service_id = services.id
        ORDER BY demandes.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql);

    return resultats;
}

module.exports = {
    creerDemande,
    trouverDemandesParClient,
    trouverDemandesParArtisan,
    modifierStatutDemande,
    trouverToutesLesDemandesParAdmin
};