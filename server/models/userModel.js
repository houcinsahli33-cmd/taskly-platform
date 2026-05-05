// Ce fichier contient les requêtes SQL liées à la table users.
// Il sera utilisé par les controllers pour créer un utilisateur,
// chercher un utilisateur par email ou récupérer ses informations.

const db = require("../config/db");

// Chercher un utilisateur avec son email
async function trouverUtilisateurParEmail(email) {
  const sql = "SELECT * FROM users WHERE email = ?";

  const [resultats] = await db.promise().query(sql, [email]);

  return resultats[0];
}

// Créer un nouvel utilisateur
async function creerUtilisateur(nom, prenom, email, motDePasse, role) {
  const sql = `
    INSERT INTO users (nom, prenom, email, mot_de_passe, role)
    VALUES (?, ?, ?, ?, ?)
  `;

  const [resultat] = await db.promise().query(sql, [
    nom,
    prenom,
    email,
    motDePasse,
    role
  ]);

  return resultat;
}

// Récupérer tous les utilisateurs
async function trouverTousLesUtilisateurs() {
    const sql = `
        SELECT id, nom, prenom, email, role, created_at
        FROM users
        ORDER BY id DESC
    `;

    const [resultats] = await db.promise().query(sql);

    return resultats;
}

module.exports = {
  trouverUtilisateurParEmail,
  creerUtilisateur,
  trouverTousLesUtilisateurs
};