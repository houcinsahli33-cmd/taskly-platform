-- Une adresse : un client (0) et deux artisans (1,2). Aucun compte existant supprimé.
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,'ALTER TABLE users ADD COLUMN compte_slot TINYINT UNSIGNED NOT NULL DEFAULT 0','SELECT 1') FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='compte_slot');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
UPDATE users SET compte_slot=1 WHERE role='artisan' AND compte_slot=0;
SET @taskly_ddl = (SELECT IF(COUNT(*)=0,'ALTER TABLE users ADD UNIQUE KEY taskly_email_slot (email,compte_slot)','SELECT 1') FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND index_name='taskly_email_slot');
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
SET @taskly_index = (SELECT index_name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='users' AND non_unique=0 AND index_name!='PRIMARY' GROUP BY index_name HAVING COUNT(*)=1 AND MAX(column_name)='email' LIMIT 1);
SET @taskly_ddl = IF(@taskly_index IS NULL,'SELECT 1',CONCAT('ALTER TABLE users DROP INDEX `',REPLACE(@taskly_index,'`','``'),'`'));
PREPARE taskly_stmt FROM @taskly_ddl;
EXECUTE taskly_stmt;
DEALLOCATE PREPARE taskly_stmt;
