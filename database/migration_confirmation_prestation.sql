-- Taskly : confirmation de fin de prestation. Sauvegarder la base avant exécution.
-- Prérequis : migration_notifications_taskly.sql (file e-mail).
ALTER TABLE demandes MODIFY COLUMN statut
 ENUM('en_attente','acceptee','refusee','annulee','terminee','attente_confirmation','conteste')
 NOT NULL DEFAULT 'en_attente';
CREATE TABLE IF NOT EXISTS taskly_confirmations (
 demande_id INT NOT NULL PRIMARY KEY,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 used_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (demande_id) REFERENCES demandes(id) ON DELETE CASCADE
);
