-- Pilote : demandes uniquement. Aucun compte de messagerie n'est activé ici.
CREATE TABLE IF NOT EXISTS taskly_professional_mail_requests (
 user_id INT NOT NULL PRIMARY KEY,
 artisan_id INT NOT NULL,
 service_id INT NOT NULL,
 personal_email VARCHAR(255) NOT NULL,
 proposed_address VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 status ENUM('pending_confirmation','pending_admin','cancelled','rejected','approved_pending_provider') NOT NULL DEFAULT 'pending_confirmation',
 code_hash CHAR(64) NULL,
 expires_at DATETIME NULL,
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 confirmed_at DATETIME NULL,
 decided_at DATETIME NULL,
 decided_by INT NULL,
 refusal_reason VARCHAR(500) NULL,
 UNIQUE KEY uq_taskly_professional_address (proposed_address),
 KEY idx_taskly_mail_review (status, user_id),
 CONSTRAINT fk_taskly_mail_request_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
