-- Présence courte des comptes connectés (Client/Artisan) ; aucune adresse ni position.
-- Exécuter sur TiDB uniquement après sauvegarde, avec TASKLY_CHAT_PRESENCE_ENABLED=false.
CREATE TABLE IF NOT EXISTS taskly_chat_presence (
 user_id INT NOT NULL PRIMARY KEY,
 seen_at DATETIME(3) NOT NULL,
 CONSTRAINT fk_taskly_chat_presence_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
