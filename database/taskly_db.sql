-- Ce fichier contient la structure de la base de données du projet Taskly.
-- Il crée la base taskly_db et les tables principales : users, clients, services, artisans et demandes. Ce fichier peut être importé dans phpMyAdmin pour recréer la base.

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
    photo_profil VARCHAR(255),
    statut_compte ENUM('actif', 'bloque') DEFAULT 'actif',
    motif_blocage TEXT,
    date_blocage DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des clients. Elle contient les informations spécifiques aux clients
CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    telephone VARCHAR(20) NOT NULL,
    ville VARCHAR(255) NOT NULL,
    adresse VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des services. Elle contient les catégories comme plomberie, électricité, peinture...
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY, -- id du service
    nom VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    image VARCHAR(255)
);

-- Table des artisans. Elle contient les informations spécifiques aux artisans
CREATE TABLE IF NOT EXISTS artisans (
    id INT AUTO_INCREMENT PRIMARY KEY, -- id de l'artisan
    user_id INT NOT NULL UNIQUE,       
    service_id INT NOT NULL,    
    ville VARCHAR(255) NOT NULL,
    telephone VARCHAR(20) NOT NULL,
    description TEXT,
    experience INT DEFAULT 0 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, -- id de l'utilisateur dans users, suppression de l'artisan si le compte utilisateur est supprimé
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE  -- id du service dans services, suppression de l'artisan si le service est supprimé
);

CREATE TABLE IF NOT EXISTS demandes (
    id INT AUTO_INCREMENT PRIMARY KEY, -- id de la demande
    client_id INT NOT NULL,
    artisan_id INT NOT NULL,
    message TEXT,
    adresse VARCHAR(255),
    date_souhaitee DATE DEFAULT NULL,
    statut ENUM('en_attente', 'acceptee', 'refusee', 'annulee', 'terminee') DEFAULT 'en_attente',
    annulee_par ENUM('client', 'artisan') DEFAULT NULL,
    motif_annulation TEXT,
    date_traitement DATETIME DEFAULT NULL,
    date_annulation DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE, -- id du client dans clients, suppression de la demande si le compte utilisateur est supprimé
    FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE -- id de l'artisan dans artisans, suppression de la demande si l'artisan est supprimé
);

CREATE TABLE IF NOT EXISTS avis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    demande_id INT NOT NULL UNIQUE,
    client_id INT NOT NULL,
    artisan_id INT NOT NULL,
    note INT NOT NULL,
    commentaire TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (demande_id) REFERENCES demandes(id) ON DELETE CASCADE, -- id de la demande dans demandes, suppression de l'avis si la demande est supprimé
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE, -- id du client dans clients, suppression de l'avis si le compte utilisateur est supprimé
    FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE, -- id de l'artisan dans artisans, suppression de l'avis si l'artisan est supprimé

    CHECK (note >= 1 AND note <= 5) -- La note doit etre comprise entre 1 et 5
);

CREATE TABLE IF NOT EXISTS signalements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    demande_id INT NOT NULL,
    signaleur_user_id INT NOT NULL,
    signale_user_id INT NOT NULL,
    motif VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (demande_id) REFERENCES demandes(id) ON DELETE CASCADE,
    FOREIGN KEY (signaleur_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (signale_user_id) REFERENCES users(id) ON DELETE CASCADE,

    UNIQUE (demande_id, signaleur_user_id, signale_user_id)
);

-- Données de test pour les services
-- Elles permettent de tester l'inscription artisan et l'affichage des catégories
INSERT INTO services (nom, description, image) VALUES
('Plomberie', 'Services de plomberie pour la maison.', 'plomberie.jpg'),
('Électricité', 'Installation et réparation électrique.', 'electricite.jpg'),
('Peinture', 'Travaux de peinture intérieure et extérieure.', 'peinture.jpg'),
('Menuiserie', 'Fabrication et réparation en bois.', 'menuiserie.jpg'),
('Nettoyage', 'Services de nettoyage pour maisons et locaux.', 'nettoyage.jpg'),
('Climatisation', 'Installation et réparation de climatiseurs.', 'climatisation.jpg');