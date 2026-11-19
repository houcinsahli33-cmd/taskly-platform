-- À appliquer après migration_taskly_mail_pilot.sql, sur la base de test d'abord.
-- Aucune modification ou suppression de comptes existants.
CREATE TABLE IF NOT EXISTS taskly_professional_mailboxes (
 user_id INT NOT NULL PRIMARY KEY,
 address VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
 provider_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 provisioned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 activated_at DATETIME NULL,
 activation_hash CHAR(64) NULL,
 activation_expires_at DATETIME NULL,
 activation_requested_at DATETIME NULL,
 activation_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 UNIQUE KEY uq_taskly_mailbox_address (address),
 UNIQUE KEY uq_taskly_mailbox_provider (provider_id),
 CONSTRAINT fk_taskly_mailbox_request FOREIGN KEY (user_id) REFERENCES taskly_professional_mail_requests(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS taskly_professional_mail_drafts (
 user_id INT NOT NULL PRIMARY KEY,
 recipient VARCHAR(254) NOT NULL DEFAULT '',
 subject VARCHAR(200) NOT NULL DEFAULT '',
 body TEXT NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_taskly_mail_draft_box FOREIGN KEY (user_id) REFERENCES taskly_professional_mailboxes(user_id) ON DELETE CASCADE
);
