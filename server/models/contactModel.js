// Ce fichier contient les requêtes SQL liées aux messages de contact/support.

const db = require("../config/db");

// Lecture compatible avec une base académique antérieure à la migration comptes/support.
// Ne masquer ni les erreurs de connexion, ni une colonne de base réellement manquante.
const colonnesOptionnelles = ['user_id', 'contexte', 'login_verified_at'];
async function lireContacts(sql, valeurs, sqlAncien) {
    try {
        const [resultats] = await db.promise().query(sql, valeurs);
        return resultats;
    } catch (erreur) {
        const colonneManquante = erreur.code === 'ER_BAD_FIELD_ERROR' &&
            colonnesOptionnelles.some(nom => (erreur.sqlMessage || erreur.message || '').includes(nom));
        if (!colonneManquante) throw erreur;
        const [resultats] = await db.promise().query(sqlAncien, valeurs);
        return resultats;
    }
}
const champsSupport = `id, nom, email, sujet, message, statut, created_at,
            date_traitement, user_id, contexte, login_verified_at`;
const champsSupportAncien = `id, nom, email, sujet, message, statut, created_at,
            date_traitement, NULL AS user_id, 'public' AS contexte, NULL AS login_verified_at`;

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
    const sql = `SELECT ${champsSupport} FROM contacts_support
        WHERE id = ? AND email = ? AND contexte = 'public'`;
    const ancien = `SELECT ${champsSupportAncien} FROM contacts_support
        WHERE id = ? AND email = ?`;
    const resultats = await lireContacts(sql, [id, email], ancien);
    return resultats[0];
}

// Lister les messages de contact par l'admin
async function listerMessagesContact(statut) {
    const condition = statut ? ' WHERE statut = ?' : '';
    const valeurs = statut ? [statut] : [];
    return lireContacts(
        `SELECT ${champsSupport} FROM contacts_support${condition} ORDER BY created_at DESC`,
        valeurs,
        `SELECT ${champsSupportAncien} FROM contacts_support${condition} ORDER BY created_at DESC`
    );
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
    return lireContacts(
        `SELECT ${champsSupport} FROM contacts_support ORDER BY created_at DESC LIMIT 8`,
        [],
        `SELECT ${champsSupportAncien} FROM contacts_support ORDER BY created_at DESC LIMIT 8`
    );
}

module.exports = {
    creerMessageContact,
    trouverMessageContactParIdEtEmail,
    listerMessagesContact,
    traiterMessageContact,
    derniersMessagesContact
};