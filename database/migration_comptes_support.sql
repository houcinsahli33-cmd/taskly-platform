-- Après sauvegarde, exécuter sur la base choisie. Réexécutable. Aucun artisan existant activé automatiquement.
SET @taskly_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE contacts_support ADD COLUMN user_id INT NULL', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='contacts_support' AND column_name='user_id');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE contacts_support ADD COLUMN contexte VARCHAR(40) NOT NULL DEFAULT ''public''', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='contacts_support' AND column_name='contexte');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE contacts_support ADD COLUMN login_verified_at DATETIME NULL', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='contacts_support' AND column_name='login_verified_at');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
CREATE TABLE IF NOT EXISTS account_notifications (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, destinataire VARCHAR(255) NOT NULL,
 sujet VARCHAR(255) NOT NULL, corps TEXT NOT NULL,
 statut ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
 attempts INT NOT NULL DEFAULT 0, attempted_at DATETIME NULL, sent_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_notifications_user(user_id,created_at), INDEX idx_notifications_pending(statut,created_at)
);
CREATE TABLE IF NOT EXISTS account_email_changes (
 user_id INT PRIMARY KEY, nouveau_email VARCHAR(255) NOT NULL, code_hash CHAR(64) NOT NULL,
 expires_at DATETIME NOT NULL, attempts INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
