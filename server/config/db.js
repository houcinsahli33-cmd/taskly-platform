const mysql = require('mysql2'); // importer le module mysql2 pour la connexion à la base de données
require('dotenv').config();

// Créer une connexion à la base de données en utilisant les variables d'environnement
const pool = mysql.createPool({
  host: process.env.DB_HOST, // hôte de la base de données
  user: process.env.DB_USER, // nom d'utilisateur pour la connexion
  password: process.env.DB_PASSWORD, // mot de passe pour la connexion
  database: process.env.DB_NAME, // nom de la base de données
  port: process.env.DB_PORT // port de la base de données
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error("Erreur de connexion a la base de donnees !");
        console.error(err.message);
        return;
    }

    console.log("connexion a la base de donnees reussie !");
    connection.release();
});


module.exports = pool;