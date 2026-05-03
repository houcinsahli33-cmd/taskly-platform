CREATE DATABASE IF NOT EXISTS taskly_db; -- Création de la base de données du projet

USE taskly_db; -- Utiliser cette base de données pour les tables suivantes

-- Table des utilisateurs. Elle contient les clients, les artisans et les administrateurs
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,  -- id de l'utilisateur
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe VARCHAR(255) NOT NULL,
    role ENUM('client', 'artisan', 'admin') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des services. Elle contient les catégories comme plomberie, électricité, peinture...
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY, -- id du service
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(255)
);

-- Table des artisans. Elle contient les informations spécifiques aux artisans
CREATE TABLE IF NOT EXISTS artisans (
    id INT AUTO_INCREMENT PRIMARY KEY, -- id de l'artisan
    user_id INT NOT NULL,       
    service_id INT NOT NULL,    
    ville VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    description TEXT,
    experience INT DEFAULT 0,
    photo VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- id de l'utilisateur dans users, suppression de l'artisan si le compte utilisateur est supprimé
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE  -- id du service dans services, suppression de l'artisan si le service est supprimé
);

CREATE TABLE IF NOT EXISTS demandes (
    id INT AUTO_INCREMENT PRIMARY KEY, -- id de la demande
    client_id INT NOT NULL,
    artisan_id INT NOT NULL,
    message TEXT,
    adresse VARCHAR(255),
    date_souhaitee DATE,
    status ENUM('en attente', 'acceptee', 'refusee') DEFAULT 'en attente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE, -- id du client dans users, suppression de la demande si le compte utilisateur est supprimé
    FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE -- id de l'artisan dans artisans, suppression de la demande si l'artisan est supprimé
);