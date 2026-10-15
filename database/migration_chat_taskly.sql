-- Taskly Platform : messagerie privee par demande
-- Executer uniquement apres sauvegarde de la base.

CREATE TABLE IF NOT EXISTS taskly_chat_messages (
    id BIGINT NOT NULL AUTO_INCREMENT,
    demande_id INT NOT NULL,
    auteur_type ENUM('client', 'artisan') NOT NULL,
    auteur_profil_id INT NOT NULL,
    contenu VARCHAR(4000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lu_at DATETIME NULL,

    PRIMARY KEY (id),

    INDEX idx_chat_demande_date (
        demande_id,
        created_at,
        id
    ),

    CONSTRAINT fk_taskly_chat_demande
        FOREIGN KEY (demande_id)
        REFERENCES demandes(id)
        ON DELETE CASCADE
);