-- Messagerie privee : 1 piece jointe par message.
-- Executer manuellement dans TiDB Cloud apres sauvegarde.
CREATE TABLE IF NOT EXISTS taskly_chat_attachments (
  message_id BIGINT NOT NULL PRIMARY KEY,
  file_id CHAR(64) NOT NULL,
  filename VARCHAR(220) NOT NULL,
  media_type VARCHAR(50) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  KEY idx_taskly_chat_attach_file (file_id),
  CONSTRAINT fk_taskly_chat_attach_message
    FOREIGN KEY (message_id) REFERENCES taskly_chat_messages(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
