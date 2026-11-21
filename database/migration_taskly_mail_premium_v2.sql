-- Taskly Mail Premium V2 : réglages réels, isolés par espace.
-- Appliquer sur taskly_db après les migrations Taskly Mail V1.
-- Aucune suppression ni modification de données existantes.
CREATE TABLE IF NOT EXISTS taskly_mail_preferences (
 user_id INT NOT NULL PRIMARY KEY,
 notify_email TINYINT(1) NOT NULL DEFAULT 1,
 signature_enabled TINYINT(1) NOT NULL DEFAULT 0,
 signature VARCHAR(1200) NOT NULL DEFAULT '',
 confirm_delete TINYINT(1) NOT NULL DEFAULT 1,
 preview_enabled TINYINT(1) NOT NULL DEFAULT 1,
 auto_save TINYINT(1) NOT NULL DEFAULT 1,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_taskly_mail_preferences_box FOREIGN KEY (user_id)
  REFERENCES taskly_professional_mailboxes(user_id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
