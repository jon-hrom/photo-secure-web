ALTER TABLE t_p28211681_photo_secure_web.user_drafts ALTER COLUMN client_id SET DEFAULT 0;
UPDATE t_p28211681_photo_secure_web.user_drafts SET client_id = 0 WHERE client_id IS NULL;
ALTER TABLE t_p28211681_photo_secure_web.user_drafts ALTER COLUMN client_id SET NOT NULL;
