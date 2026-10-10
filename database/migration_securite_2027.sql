-- IMPORTANT : sauvegarder la base avant d'executer. A appliquer UNE SEULE FOIS.
USE taskly_db;

-- Les anciens comptes restent utilisables ; tous les NOUVEAUX comptes doivent confirmer leur email.
ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0;
-- Tous les comptes crees AVANT cette migration sont existants ; ne pas les bloquer retroactivement.
UPDATE users SET email_verified=1;
ALTER TABLE artisans ADD COLUMN verification_statut ENUM('en_attente','a_completer','approuve','refuse') NOT NULL DEFAULT 'en_attente';
ALTER TABLE artisans ADD COLUMN verification_commentaire VARCHAR(500) DEFAULT NULL;
ALTER TABLE artisans ADD INDEX idx_artisans_validation_service (verification_statut, service_id, created_at);
ALTER TABLE artisans ADD INDEX idx_artisans_validation_ville (verification_statut, ville);
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
-- Anciens artisans : restent en attente de controle ; pas de publication automatique.

-- Indices pour les statistiques des artisans.
CREATE INDEX idx_avis_artisan_stats ON avis (artisan_id);
CREATE INDEX idx_demandes_artisan_stats ON demandes (artisan_id);
