-- V10: migration optionnelle, à lancer sur une base de test avant activation.
-- Copies administrateur uniquement; aucune migration destructive.
CREATE TABLE IF NOT EXISTS taskly_admin_mail_messages (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 message_id CHAR(36) NOT NULL,
 folder ENUM('inbox','sent') NOT NULL,
 from_address VARCHAR(254) NOT NULL,
 to_address VARCHAR(254) NOT NULL,
 subject VARCHAR(200) NOT NULL,
 body TEXT NOT NULL,
 is_read TINYINT(1) NOT NULL DEFAULT 0,
 is_starred TINYINT(1) NOT NULL DEFAULT 0,
 archived_at DATETIME NULL,
 trashed_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_admin_mail_copy (folder,message_id),
 KEY idx_admin_mail_folder (folder,id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Suspension réversible indépendante de l'état d'approbation et des données.
ALTER TABLE taskly_professional_mailboxes
 ADD COLUMN suspended_at DATETIME NULL DEFAULT NULL;

CREATE TABLE IF NOT EXISTS taskly_admin_mail_draft (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 recipient VARCHAR(254) NOT NULL DEFAULT '',
 subject VARCHAR(200) NOT NULL DEFAULT '',
 body TEXT NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
