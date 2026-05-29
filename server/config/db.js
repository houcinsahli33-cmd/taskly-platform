// Ce fichier prépare la connexion entre Node.js et MySQL.
// Il utilise les informations du fichier .env pour se connecter à la base.

const mysql = require("mysql2"); // on importe mysql2 pour pouvoir communiquer avec MySQL depuis Node.js
require("dotenv").config(); // on importe le fichier .env pour lire les valeurs comme DB_HOST, DB_USER, DB_PASSWORD

const pool = mysql.createPool({  // on cree un pool de connexion MySQL
  host: process.env.DB_HOST,    // on recupere l'adresse MySQL depuis le fichier .env
  port: process.env.DB_PORT,    // on recupere le port MySQL depuis le fichier .env
  user: process.env.DB_USER,    // on recupere l'utilisateur MySQL depuis le fichier .env
  password: process.env.DB_PASSWORD,  // on recupere le mot de passe MySQL depuis le fichier .env
  database: process.env.DB_NAME    // on recupere le nom de la base de donnees MySQL depuis le fichier .env
});

pool.getConnection((err, connection) => {   // on recupere une connexion de la base de donnees
  if (err) {
    console.error("Erreur de connexion à la base de données !");    // on affiche un message d'erreur si la connexion a echoue
    console.error(err.message);
    return;
  }

  console.log("Connexion à la base de données réussie !");  // sinon on affiche un message de reussite
  connection.release(); // on libere la connexion, c'est a dire : on la rend disponible pour d'autres requetes
});

module.exports = pool;  // on exporte le pool de connexion pour l'utiliser dans les models