-- Après sauvegarde. Migration rejouable, conserve les préférences existantes.
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,'ALTER TABLE artisans ADD COLUMN afficher_telephone TINYINT(1) NOT NULL DEFAULT 0','SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='artisans' AND column_name='afficher_telephone');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,'ALTER TABLE artisans ADD COLUMN email_professionnel VARCHAR(254) DEFAULT NULL','SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='artisans' AND column_name='email_professionnel');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,'ALTER TABLE artisans ADD COLUMN afficher_email TINYINT(1) NOT NULL DEFAULT 0','SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='artisans' AND column_name='afficher_email');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,'ALTER TABLE artisans ADD COLUMN autoriser_messagerie TINYINT(1) NOT NULL DEFAULT 1','SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='artisans' AND column_name='autoriser_messagerie');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
