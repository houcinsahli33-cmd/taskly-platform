CREATE TABLE IF NOT EXISTS taskly_mail_attachments (
    copy_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    file_id CHAR(64) NOT NULL,
    filename VARCHAR(220) NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    sha256 CHAR(64) NOT NULL,
    KEY idx_taskly_mail_attachment_file (file_id),
    CONSTRAINT fk_taskly_mail_attachment_copy FOREIGN KEY (copy_id)
        REFERENCES taskly_professional_mail_messages(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
