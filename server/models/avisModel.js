// Ce fichier contient les requêtes SQL liées aux avis.
// Il permet de créer un avis, vérifier si une demande peut recevoir un avis, et récupérer les avis d'un artisan.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// Chercher si une demande a deja un avis
async function trouverAvisParDemande(demandeId) {
    const sql = "SELECT * FROM avis WHERE demande_id = ?";
    const [resultats] = await db.promise().query(sql, [demandeId]);

    return resultats[0];
}

// Verifier que la demande appartient au client connecte et qu'elle est terminee
async function trouverDemandeTermineeClient(demandeId, clientId) {
    const sql = `
        SELECT *
        FROM demandes
        WHERE id = ?
        AND client_id = ?
        AND statut = 'terminee'
    `;

    const [resultats] = await db.promise().query(sql, [demandeId, clientId]);

    return resultats[0];
}

// Creer un avis
async function creerAvis(demandeId, clientId, artisanId, note, commentaire) {
    const sql = `
        INSERT INTO avis (demande_id, client_id, artisan_id, note, commentaire)
        VALUES (?, ?, ?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [demandeId, clientId, artisanId, note, commentaire]);
    return resultat;
}

// Lister les avis publics d'un artisan
async function listerAvisArtisan(artisanId) {
    const sql = `
        SELECT
            avis.id,
            avis.demande_id,
            avis.note,
            avis.commentaire,
            avis.created_at,

            users.nom AS client_nom,
            users.prenom AS client_prenom
        FROM avis
        JOIN clients ON avis.client_id = clients.id
        JOIN users ON clients.user_id = users.id
        WHERE avis.artisan_id = ?
        ORDER BY avis.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql, [artisanId]);
    return resultats;
}

// Nombre d'avis et moyenne des notes d'un artisan
async function statistiquesAvisArtisan(artisanId) {
    const sql = `
        SELECT
            COUNT(*) AS total_avis,
            ROUND(AVG(note), 1) AS moyenne_note
        FROM avis
        WHERE artisan_id = ?
    `;

    const [resultats] = await db.promise().query(sql, [artisanId]);
    return resultats[0];
}

module.exports = {
    trouverAvisParDemande,
    trouverDemandeTermineeClient,
    creerAvis,
    listerAvisArtisan,
    statistiquesAvisArtisan
};