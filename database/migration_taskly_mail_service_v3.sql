-- TASKLY MAIL V3 / phase 2A : stockage des fils Support.
-- Executer manuellement sur une BASE DE TEST en premier.
-- Aucune alteration des tables Taskly Mail client/artisan existantes.
CREATE TABLE IF NOT EXISTS taskly_mail_service_threads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_name ENUM('support','administration') NOT NULL,
  user_id INT NOT NULL,
  user_address VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  subject VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_service_updated (service_name,updated_at,id),
  KEY idx_user_threads (user_id,updated_at,id),
  CONSTRAINT fk_taskly_mail_service_thread_user FOREIGN KEY (user_id)
    REFERENCES taskly_professional_mailboxes(user_id) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS taskly_mail_service_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  thread_id BIGINT UNSIGNED NOT NULL,
  sender_kind ENUM('user','admin') NOT NULL,
  sender_user_id INT NULL,
  sender_admin_id INT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_service_entry_id (id,thread_id),
  KEY idx_service_entry_thread (thread_id,id),
  CONSTRAINT fk_taskly_mail_service_entry_thread FOREIGN KEY (thread_id)
    REFERENCES taskly_mail_service_threads(id) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
