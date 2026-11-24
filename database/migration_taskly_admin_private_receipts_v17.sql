-- Taskly V17: read receipts.
-- No plaintext or cryptographic keys.
-- Do not execute on production during development.

CREATE TABLE IF NOT EXISTS taskly_admin_private_receipts (
    message_id BIGINT UNSIGNED NOT NULL,
    reader_user_id INT NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (message_id,reader_user_id),
    KEY idx_admin_private_reader (reader_user_id,message_id),

    CONSTRAINT fk_admin_private_receipt_message
        FOREIGN KEY (message_id)
        REFERENCES taskly_admin_private_messages(id)
        ON DELETE CASCADE

) DEFAULT CHARACTER SET utf8mb4;