-- Horodatage UTC des déclarations réelles. Les anciennes demandes restent inchangées.
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS intervention_debut_utc DATETIME NULL;
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS intervention_fin_utc DATETIME NULL;
