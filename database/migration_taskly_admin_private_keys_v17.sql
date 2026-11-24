-- Taskly V17: public keys only.
-- Single identity per participant and conversation.
-- TEST DATABASE ONLY. No automatic migration.

CREATE TABLE IF NOT EXISTS taskly_admin_private_public_keys (
    thread_id BIGINT UNSIGNED NOT NULL,
    user_id INT NOT NULL,
    public_key VARCHAR(87)
        CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (thread_id, user_id),
    CONSTRAINT fk_admin_private_key_thread
        FOREIGN KEY (thread_id)
        REFERENCES taskly_admin_private_threads(id)
        ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4;