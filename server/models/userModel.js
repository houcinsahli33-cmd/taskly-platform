// Ce fichier contient les requêtes SQL liées à la table users. 
// Il sera utilisé par les controllers pour créer un utilisateur, chercher un utilisateur par email ou récupérer ses informations.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// chercher un utilisateur par son email
async function trouverUtilisateurParEmail(email) {
    const sql = "SELECT * FROM users WHERE email = ?";  // requete SQL pour trouver un utilisateur par son email
    const [resultats] = await db.promise().query(sql, [email]); // on execute la requete, on attends et on recupere les resultats dans un tableau
    return resultats[0]; // on retourne le premier et dernier resultat si il y en a un puisque c'est 0 ou 1
}

// cree un nouvel utilisateur
async function creerUtilisateur(nom, prenom, email, motDePasse, role) {
    const sql = "INSERT INTO users (nom, prenom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, ?)";

    const [resultat] = await db.promise().query(sql, [nom, prenom, email, motDePasse, role]);   // on execute la requete et on attends et on recupere le resultat
    return resultat;    // on retourne le resultat qui est l'id de l'utilisateur
}

// Trouver un utilisateur par son id
async function trouverUtilisateurParId(id) {
    const sql = `
        SELECT id, nom, prenom, email, role, photo_profil, statut_compte, motif_blocage, email_verified, admin_session_version
        FROM users
        WHERE id = ?
    `;

    const [resultats] = await db.promise().query(sql, [id]);

    return resultats[0];
}

// Modifier la photo de profil d'un utilisateur
async function modifierPhotoProfil(userId, photoProfil) {
    const sql = `
        UPDATE users
        SET photo_profil = ?
        WHERE id = ?
    `;

    const [resultat] = await db.promise().query(sql, [
        photoProfil,
        userId
    ]);

    return resultat;
}

// Supprimer la photo de profil d'un utilisateur
async function supprimerPhotoProfil(userId) {
    const sql = `
        UPDATE users
        SET photo_profil = NULL
        WHERE id = ?
    `;

    const [resultat] = await db.promise().query(sql, [userId]);

    return resultat;
}

// exportation des fonctions pour pouvoir les utiliser dans d'autres fichiers
async function trouverEspacesParEmail(email){
 const [rows]=await db.promise().query('SELECT u.*,a.verification_statut,s.nom AS service_nom FROM users u LEFT JOIN artisans a ON a.user_id=u.id LEFT JOIN services s ON s.id=a.service_id WHERE u.email=? ORDER BY u.id',[email]);
 return rows;
}
module.exports = {
    trouverEspacesParEmail,
    trouverUtilisateurParEmail,
    creerUtilisateur,
    trouverUtilisateurParId,
    modifierPhotoProfil,
    supprimerPhotoProfil
};