-- V14: permits authenticated Support conversations with existing clients/artisans
-- who have not requested professional mail. Apply after DB backup and staging tests.
-- Does not alter private chats, user accounts, LiveKit or automatic mailbox provisioning.
-- Existing threads and entries are not deleted.
ALTER TABLE taskly_mail_service_threads
  DROP FOREIGN KEY fk_taskly_mail_service_thread_user;
ALTER TABLE taskly_mail_service_threads
  ADD CONSTRAINT fk_taskly_mail_service_thread_account
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
