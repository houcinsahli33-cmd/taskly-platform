-- Sauvegarder la base et les anciens fichiers avant exécution. Sélectionner la base cible.
-- Réexécutable, sans remise à zéro des vérifications existantes. Aucun principal attribué automatiquement.
SET @taskly_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='email_verified');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE users ADD COLUMN admin_session_version INT NOT NULL DEFAULT 0', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='admin_session_version');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE artisans ADD COLUMN verification_statut ENUM(''en_attente'',''a_completer'',''approuve'',''refuse'') NOT NULL DEFAULT ''en_attente''', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='artisans' AND column_name='verification_statut');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE artisans ADD COLUMN verification_commentaire VARCHAR(500) DEFAULT NULL', 'SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='artisans' AND column_name='verification_commentaire');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
CREATE TABLE IF NOT EXISTS verification_codes (
  user_id INT NOT NULL,
  purpose ENUM('email','admin_login') NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, purpose),
  CONSTRAINT fk_codes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS artisan_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  type_document ENUM('identite','diplome','certificat','qualification') NOT NULL,
  stored_name CHAR(64) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  media_type VARCHAR(50) NOT NULL,
  taille INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_artisan FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE,
  INDEX idx_docs_artisan (artisan_id)
);
CREATE TABLE IF NOT EXISTS verification_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  artisan_id INT NOT NULL,
  admin_user_id INT NOT NULL,
  ancien_statut VARCHAR(32),
  nouveau_statut VARCHAR(32) NOT NULL,
  commentaire VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_artisan (artisan_id, created_at),
  FOREIGN KEY (artisan_id) REFERENCES artisans(id),
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admin_roles (
 user_id INT PRIMARY KEY, niveau ENUM('principal','secondaire') NOT NULL DEFAULT 'secondaire',
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS admin_invitations (
 id INT AUTO_INCREMENT PRIMARY KEY, nom VARCHAR(100) NOT NULL, prenom VARCHAR(100) NOT NULL,
 email VARCHAR(255) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, created_by INT NOT NULL,
 expires_at DATETIME NOT NULL, accepted_at DATETIME NULL, revoked_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS admin_email_changes (
 user_id INT PRIMARY KEY, nouveau_email VARCHAR(255) NOT NULL, code_hash CHAR(64) NOT NULL,
 expires_at DATETIME NOT NULL, attempts INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS admin_audit_logs (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, admin_user_id INT NOT NULL, action VARCHAR(100) NOT NULL,
 cible_id INT NULL, detail TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(admin_user_id) REFERENCES users(id), INDEX idx_admin_audit(admin_user_id,created_at)
);
CREATE TABLE IF NOT EXISTS stored_files (
 id CHAR(64) PRIMARY KEY, media_type VARCHAR(50) NOT NULL, prive TINYINT NOT NULL,
 contenu MEDIUMBLOB NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
