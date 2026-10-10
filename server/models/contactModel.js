// Ce fichier contient les requêtes SQL liées aux messages de contact/support.

const db = require("../config/db");

// Creer un message de contact
async function creerMessageContact(nom, email, sujet, message) {
    const sql = `
        INSERT INTO contacts_support (nom, email, sujet, message)
        VALUES (?, ?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [nom, email, sujet, message]);
    return resultat;
}

// Consulter un message de contact avec son id et son email
async function trouverMessageContactParIdEtEmail(id, email) {
    const sql = `
        SELECT
            id,
            nom,
            email,
            sujet,
            message,
            statut,
            created_at,
            date_traitement
        FROM contacts_support
        WHERE id = ?
        AND email = ?
    `;

    const [resultats] = await db.promise().query(sql, [id, email]);
    return resultats[0];
}

// Lister les messages de contact par l'admin
async function listerMessagesContact(statut) {
    let sql = `
        SELECT
            id,
            nom,
            email,
            sujet,
            message,
            statut,
            created_at,
            date_traitement
        FROM contacts_support
    `;

    const valeurs = [];

    if (statut) {
        sql += " WHERE statut = ?";
        valeurs.push(statut);
    }

    sql += " ORDER BY created_at DESC";

    const [resultats] = await db.promise().query(sql, valeurs);

    return resultats;
}

// Marquer un message comme traite
async function traiterMessageContact(id) {
    const sql = `
        UPDATE contacts_support
        SET statut = 'traite',
            date_traitement = NOW()
        WHERE id = ?
    `;

    const [resultat] = await db.promise().query(sql, [id]);
    return resultat;
}

// Recuperer les derniers messages de contact/support
async function derniersMessagesContact() {
    const sql = `
        SELECT
            id,
            nom,
            email,
            sujet,
            message,
            statut,
            created_at,
            date_traitement
        FROM contacts_support
        ORDER BY created_at DESC
        LIMIT 8
    `;

    const [resultats] = await db.promise().query(sql);
    return resultats;
}

module.exports = {
    creerMessageContact,
    trouverMessageContactParIdEtEmail,
    listerMessagesContact,
    traiterMessageContact,
    derniersMessagesContact
};