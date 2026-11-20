-- Extension Taskly Mail aux profils Client.
-- A tester sur une base isolee avant production.
-- Conservation des demandes et boites existantes.

ALTER TABLE taskly_professional_mail_requests
    MODIFY COLUMN artisan_id INT NULL;

ALTER TABLE taskly_professional_mail_requests
    MODIFY COLUMN service_id INT NULL;

ALTER TABLE taskly_professional_mail_requests
    ADD COLUMN client_id INT NULL;