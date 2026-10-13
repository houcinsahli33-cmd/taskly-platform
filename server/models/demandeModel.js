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
            CASE WHEN demandes.statut IN ('acceptee','attente_confirmation','terminee','conteste') THEN demandes.adresse ELSE NULL END AS adresse,
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

            CASE WHEN demandes.statut IN ('acceptee','attente_confirmation','terminee','conteste') THEN clients.telephone ELSE NULL END AS client_telephone,
            clients.ville AS client_ville,
            CASE WHEN demandes.statut IN ('acceptee','attente_confirmation','terminee','conteste') THEN clients.adresse ELSE NULL END AS client_adresse
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
        SET statut = 'attente_confirmation',
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



// Lecture ciblée : impossible de consulter la demande d'un autre artisan.
async function detailArtisan(id, artisanId) {
    const [lignes] = await db.promise().query(`
        SELECT d.*, u.nom AS client_nom, u.prenom AS client_prenom,
            u.email AS client_email, c.telephone AS client_telephone,
            c.ville AS client_ville, s.nom AS service_nom
        FROM demandes d
        JOIN clients c ON c.id = d.client_id
        JOIN users u ON u.id = c.user_id
        JOIN artisans a ON a.id = d.artisan_id
        LEFT JOIN services s ON s.id = a.service_id
        WHERE d.id = ? AND d.artisan_id = ? LIMIT 1
    `, [id, artisanId]);
    return lignes[0] || null;
}


// Les destinataires viennent de la demande réellement enregistrée, pas du corps HTTP.
async function trouverDestinataires(id) {
    const [rows] = await db.promise().query(`
        SELECT d.id,
            uc.id AS client_user_id, uc.email AS client_email,
            uc.prenom AS client_prenom, uc.nom AS client_nom,
            ua.id AS artisan_user_id, ua.email AS artisan_email,
            ua.prenom AS artisan_prenom, ua.nom AS artisan_nom
        FROM demandes d
        JOIN clients c ON c.id = d.client_id
        JOIN users uc ON uc.id = c.user_id
        JOIN artisans a ON a.id = d.artisan_id
        JOIN users ua ON ua.id = a.user_id
        WHERE d.id = ? LIMIT 1
    `, [id]);
    return rows[0] || null;
}

// Le compte client connecté ne peut agir que sur ses propres demandes.
async function confirmerFinClient(id, clientId) {
    const [resultat] = await db.promise().query(`UPDATE demandes
        SET statut='terminee', date_traitement=NOW()
        WHERE id=? AND client_id=? AND statut='attente_confirmation'`,[id,clientId]);
    return resultat;
}
async function contesterFinClient(id, clientId) {
    const [resultat] = await db.promise().query(`UPDATE demandes
        SET statut='conteste',date_traitement=NOW()
        WHERE id=? AND client_id=? AND statut='attente_confirmation'`,[id,clientId]);
    return resultat;
}
module.exports = {
    confirmerFinClient,
    contesterFinClient,
    trouverDestinataires,
    detailArtisan,
    creerDemande,
    listerDemandesClient,
    listerDemandesArtisan,
    modifierStatutDemande,
    annulerDemandeClient,
    annulerDemandeArtisan,
    terminerDemande
};