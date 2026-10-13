-- À exécuter après sauvegarde MySQL, avant de déployer les notifications.
-- Ne modifie pas les comptes, demandes ou statuts existants.
CREATE TABLE IF NOT EXISTS taskly_mail_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    destinataire VARCHAR(255) NOT NULL,
    sujet VARCHAR(255) NOT NULL,
    corps TEXT NOT NULL,
    html MEDIUMTEXT NOT NULL,
    cle VARCHAR(180) NOT NULL UNIQUE,
    statut ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_attempt DATETIME NULL,
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX taskly_queue_next(statut,created_at)
);
