-- Exécuter après sauvegarde avant le déploiement du code de suivi des sessions.
CREATE TABLE IF NOT EXISTS taskly_session_activity (
 session_hash CHAR(64) PRIMARY KEY,
 user_id INT NOT NULL,
 email VARCHAR(255) NOT NULL,
 role VARCHAR(30) NOT NULL,
 expires_at DATETIME NOT NULL,
 notified_at DATETIME DEFAULT NULL,
 INDEX taskly_session_expires(expires_at,notified_at)
);
