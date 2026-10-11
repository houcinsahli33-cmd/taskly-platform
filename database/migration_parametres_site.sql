-- Sauvegarder la base avant exécution. Aucun compte ni rôle n'est modifié.
CREATE TABLE IF NOT EXISTS site_settings (
  cle VARCHAR(50) NOT NULL PRIMARY KEY,
  valeur VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Les coordonnées déjà enregistrées sont conservées lors d'une seconde exécution.
INSERT IGNORE INTO site_settings (cle,valeur) VALUES
('email','support@taskly.dz'),('facebook',''),('instagram',''),('twitter',''),('linkedin','');
