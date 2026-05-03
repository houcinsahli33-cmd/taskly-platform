// Ce fichier contient les requêtes SQL liées à la table users.
// Il sera utilisé par les controllers pour créer un utilisateur,
// chercher un utilisateur par email ou récupérer ses informations.

const db = require("../config/db");

// Chercher un utilisateur avec son email
function trouverUtilisateurParEmail(email, callback) {
  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], callback);
}

// Créer un nouvel utilisateur
function creerUtilisateur(nom, prenom, email, motDePasse, role, callback) {
  const sql = `
    INSERT INTO users (nom, prenom, email, mot_de_passe, role)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [nom, prenom, email, motDePasse, role], callback);
}

module.exports = {
  trouverUtilisateurParEmail,
  creerUtilisateur
};