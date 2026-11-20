-- Extension additive. Les demandes historiques conservent NULL (horaire non défini).
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS creneau_debut_minute SMALLINT UNSIGNED NULL;
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS creneau_fin_minute SMALLINT UNSIGNED NULL;
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS creneau_blocage_minute SMALLINT UNSIGNED NULL;
