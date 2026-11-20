-- One private notification per inbox copy. Only token hashes are persisted.
CREATE TABLE IF NOT EXISTS taskly_mail_read_notifications (
    owner_user_id INT NOT NULL,
    message_id CHAR(36) NOT NULL,
    status ENUM('pending','sending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
    token_hash CHAR(64) DEFAULT NULL,
    email_hash CHAR(64) DEFAULT NULL,
    expires_at DATETIME DEFAULT NULL,
    used_at DATETIME DEFAULT NULL,
    last_attempt DATETIME DEFAULT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_user_id,message_id),
    UNIQUE KEY uq_taskly_read_token (token_hash),
    KEY idx_taskly_read_retry (status,attempts,last_attempt),
    CONSTRAINT fk_taskly_read_owner FOREIGN KEY (owner_user_id) REFERENCES taskly_professional_mailboxes(user_id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
