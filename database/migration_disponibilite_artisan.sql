-- TiDB : extension additive, aucun compte existant modifie.
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS disponibilite_statut ENUM('non_renseignee','disponible','occupe','indisponible') NOT NULL DEFAULT 'non_renseignee';
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS disponibilite_expiration DATETIME NULL;
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS intervention_rapide TINYINT(1) NOT NULL DEFAULT 0;
