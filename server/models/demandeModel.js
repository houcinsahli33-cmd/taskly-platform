// Ce fichier contient les requêtes SQL liées à la table demandes.
// Il permet de créer une demande, lister les demandes et modifier leur statut

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// Creer une demande par un client à un artisan
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

// Lister les demandes envoyees par un client
async function listerDemandesClient(clientId) {
    const sql = `
        SELECT
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,
            demandes.message,
            demandes.adresse,
            demandes.date_souhaitee,
            demandes.statut,
            demandes.annulee_par,
            demandes.motif_annulation,
            demandes.date_traitement,
            demandes.date_annulation,
            demandes.created_at,

            users.nom AS artisan_nom,
            users.prenom AS artisan_prenom,
            users.photo_profil AS artisan_photo_profil,

            artisans.ville AS artisan_ville,
            artisans.telephone AS artisan_telephone,
            artisans.experience AS artisan_experience,

            services.nom AS service_nom,

            avis.id AS avis_id,
            avis.note AS avis_note
        FROM demandes
        JOIN artisans ON demandes.artisan_id = artisans.id
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        LEFT JOIN avis ON demandes.id = avis.demande_id
        WHERE demandes.client_id = ?
        ORDER BY demandes.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql, [clientId]);

    return resultats;
}

// Lister les demandes recues par un artisan
async function listerDemandesArtisan(artisanId) {
    const sql = `
        SELECT
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,
            demandes.message,
            demandes.adresse,
            demandes.date_souhaitee,
            demandes.statut,
            demandes.annulee_par,
            demandes.motif_annulation,
            demandes.date_traitement,
            demandes.date_annulation,
            demandes.created_at,

            users.nom AS client_nom,
            users.prenom AS client_prenom,
            users.photo_profil AS client_photo_profil,

            clients.telephone AS client_telephone,
            clients.ville AS client_ville,
            clients.adresse AS client_adresse
        FROM demandes
        JOIN clients ON demandes.client_id = clients.id
        JOIN users ON clients.user_id = users.id
        WHERE demandes.artisan_id = ?
        ORDER BY demandes.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql, [artisanId]);

    return resultats;
}

// Modifier le statut d'une demande par un artisan : accepter ou refuser
async function modifierStatutDemande(id, artisanId, statut) {
    const sql = `
        UPDATE demandes
        SET statut = ?,
            date_traitement = NOW()
        WHERE id = ?
        AND artisan_id = ?
        AND statut = 'en_attente'
    `;

    const [resultat] = await db.promise().query(sql, [
        statut,
        id,
        artisanId
    ]);

    return resultat;
}

// Annuler une demande par le client
async function annulerDemandeClient(id, clientId) {
    const sql = `
        UPDATE demandes
        SET statut = 'annulee',
            annulee_par = 'client',
            date_annulation = NOW()
        WHERE id = ? 
        AND client_id = ? 
        AND statut = 'en_attente'
    `;

    const [resultat] = await db.promise().query(sql, [
        id,
        clientId
    ]);

    return resultat;
}

// Annuler une demande acceptée par l'artisan avec un motif
async function annulerDemandeArtisan(id, artisanId, motifAnnulation) {
    const sql = `
        UPDATE demandes
        SET statut = 'annulee',
            annulee_par = 'artisan',
            motif_annulation = ?,
            date_annulation = NOW()
        WHERE id = ?
        AND artisan_id = ?
        AND statut = 'acceptee'
    `;

    const [resultat] = await db.promise().query(sql, [
        motifAnnulation,
        id,
        artisanId
    ]);

    return resultat;
}

// Marquer une demande acceptee comme terminee
async function terminerDemande(id, artisanId) {
    const sql = `
        UPDATE demandes
        SET statut = 'terminee',
            date_traitement = NOW()
        WHERE id = ?
        AND artisan_id = ?
        AND statut = 'acceptee'
    `;

    const [resultat] = await db.promise().query(sql, [
        id,
        artisanId
    ]);

    return resultat;
}

module.exports = {
    creerDemande,
    listerDemandesClient,
    listerDemandesArtisan,
    modifierStatutDemande,
    annulerDemandeClient,
    annulerDemandeArtisan,
    terminerDemande
};