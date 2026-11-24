-- V17P2: ADMIN <-> CLIENT/ARTISAN ONLY. Run manually in isolated TEST database.
-- Never alters chat, demande, livekit, support or professional-mail tables.
CREATE TABLE IF NOT EXISTS taskly_admin_private_threads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT NOT NULL,
  member_user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_private_pair (admin_user_id, member_user_id),
  KEY idx_admin_private_member (member_user_id,updated_at,id),
  CONSTRAINT fk_admin_private_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_private_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Stores encrypted envelopes only; application does NOT provide key exchange yet.
CREATE TABLE IF NOT EXISTS taskly_admin_private_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  thread_id BIGINT UNSIGNED NOT NULL,
  sender_user_id INT NOT NULL,
  alg VARCHAR(32) NOT NULL,
  key_version INT UNSIGNED NOT NULL,
  nonce VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ciphertext MEDIUMTEXT CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_private_messages (thread_id,id),
  CONSTRAINT fk_admin_private_msg_thread FOREIGN KEY (thread_id) REFERENCES taskly_admin_private_threads(id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_private_msg_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
