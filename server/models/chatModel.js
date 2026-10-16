"use strict";

const db = require("../config/db");

// Retrouver la demande et ses participants.
async function trouverDemande(demandeId) {
    const [rows] = await db.promise().query(
        `SELECT
            d.id,
            d.client_id,
            d.artisan_id,
            d.statut,
            d.date_traitement,
            d.date_souhaitee,
            d.adresse,
            NULLIF(TRIM(CONCAT_WS(' ', uc.prenom, uc.nom)), '') AS client_nom,
            NULLIF(TRIM(CONCAT_WS(' ', ua.prenom, ua.nom)), '') AS artisan_nom,
            c.telephone AS client_telephone,
            a.telephone AS artisan_telephone,
            s.nom AS service_nom
         FROM demandes d
         LEFT JOIN clients c ON c.id = d.client_id
         LEFT JOIN users uc ON uc.id = c.user_id
         LEFT JOIN artisans a ON a.id = d.artisan_id
         LEFT JOIN users ua ON ua.id = a.user_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE d.id = ?
         LIMIT 1`,
        [demandeId]
    );

    return rows[0] || null;
}

// Lire les 50 derniers messages dans l'ordre chronologique.
async function listerMessages(demandeId) {
    const [rows] = await db.promise().query(
        `SELECT id, demande_id, auteur_type,
                auteur_profil_id, contenu, created_at, lu_at
         FROM taskly_chat_messages
         WHERE demande_id = ?
         ORDER BY id DESC
         LIMIT 50`,
        [demandeId]
    );

    return rows.reverse();
}

// Enregistrer uniquement pour le participant de la demande acceptee.
async function envoyerMessage(demandeId, auteurType, profilId, contenu) {
    if (!["client", "artisan"].includes(auteurType)) {
        throw new Error("Type d'auteur invalide.");
    }

    const [resultat] = await db.promise().query(
        `INSERT INTO taskly_chat_messages
            (demande_id, auteur_type, auteur_profil_id, contenu)
         SELECT d.id, ?, ?, ?
         FROM demandes d
         WHERE d.id = ?
           AND d.statut = 'acceptee'
           AND (
                (? = 'client' AND d.client_id = ?)
                OR
                (? = 'artisan' AND d.artisan_id = ?)
           )`,
        [
            auteurType, profilId, contenu,
            demandeId,
            auteurType, profilId,
            auteurType, profilId
        ]
    );

    return resultat.affectedRows === 1
        ? resultat.insertId
        : null;
}

module.exports = {
    trouverDemande,
    listerMessages,
    envoyerMessage
};