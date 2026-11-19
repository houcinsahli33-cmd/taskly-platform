CREATE TABLE IF NOT EXISTS taskly_professional_mail_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NOT NULL,
    message_id CHAR(36) NOT NULL,
    idempotency_key CHAR(36) DEFAULT NULL,
    folder ENUM('inbox','sent') NOT NULL,
    from_address VARCHAR(254) NOT NULL,
    to_address VARCHAR(254) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    archived_at DATETIME DEFAULT NULL,
    trashed_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_mail_copy (owner_user_id, folder, message_id),
    UNIQUE KEY uq_mail_send (owner_user_id, idempotency_key),
    KEY idx_mail_folder (owner_user_id, folder, id),

    CONSTRAINT fk_mail_message_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES taskly_professional_mailboxes(user_id)
        ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
