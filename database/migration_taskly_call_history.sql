-- Historique des appels audio et video Taskly (metadonnees uniquement).
-- Executer apres sauvegarde de la base sur TiDB Cloud.
CREATE TABLE IF NOT EXISTS taskly_call_history (
    id CHAR(36) NOT NULL PRIMARY KEY,
    demande_id INT NOT NULL,
    caller_role ENUM('client','artisan') NOT NULL,
    mode ENUM('audio','video') NOT NULL,
    etat ENUM('ringing','answered','completed','declined','cancelled') NOT NULL DEFAULT 'ringing',
    started_at DATETIME(3) NOT NULL,
    accepted_at DATETIME(3) NULL,
    ended_at DATETIME(3) NULL,
    KEY idx_call_history_demande_date (demande_id,started_at),
    CONSTRAINT fk_taskly_call_history_demande
      FOREIGN KEY (demande_id) REFERENCES demandes(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
