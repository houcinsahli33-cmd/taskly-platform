-- Exécuter sur une copie de la base avant activation du drapeau. Vérifier existence de la colonne.
ALTER TABLE taskly_professional_mail_messages ADD COLUMN is_starred TINYINT(1) NOT NULL DEFAULT 0;
