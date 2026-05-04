CREATE database  IF NOT EXISTS taskly_db;
USE taskly_db;
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(255) NOT NULL ,
    prenom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe VARCHAR(255) NOT NULL,
    role ENUM('client', 'artisan', 'admin') NOT NULL ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des services. Elle contient les catégories comme plomberie, électricité, peinture...
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(255)
);

-- Table des artisans. Elle contient les informations spécifiques aux artisans
CREATE TABLE IF NOT EXISTS artisans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service_id INT NOT NULL,
    ville VARCHAR(255) NOT NULL,
    telephone VARCHAR(20) NOT NULL,
    description TEXT ,
    experience INT NOT NULL DEFAULT 0,
    photo VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, 
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Table des demandes envoyées par les clients aux artisans
CREATE TABLE IF NOT EXISTS demandes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    artisan_id INT NOT NULL,
    message TEXT,
    adresse VARCHAR(255),
    date_souhaitee DATE,
    statut ENUM('en_attente', 'acceptee', 'refusee') DEFAULT 'en_attente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 

    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    telephone VARCHAR(20),
    ville VARCHAR(255),
    adresse VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);