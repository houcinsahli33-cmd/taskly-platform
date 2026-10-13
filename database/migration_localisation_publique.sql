-- Exécuter après sauvegarde de la base, avant publication de la carte.
-- Coordonnées de zone de service données volontairement par les artisans.
-- Les comptes existants n'ont pas de localisation publique par défaut.
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE artisans ADD COLUMN public_lat DECIMAL(8,2) NULL', 'SELECT 1')
  FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='artisans' AND column_name='public_lat');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,
  'ALTER TABLE artisans ADD COLUMN public_lon DECIMAL(8,2) NULL', 'SELECT 1')
  FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='artisans' AND column_name='public_lon');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,
  'CREATE INDEX idx_artisans_zone ON artisans(public_lat,public_lon)', 'SELECT 1')
  FROM information_schema.statistics WHERE table_schema=DATABASE()
    AND table_name='artisans' AND index_name='idx_artisans_zone');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
