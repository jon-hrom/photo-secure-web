ALTER TABLE t_p28211681_photo_secure_web.client_projects
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT NULL;

ALTER TABLE t_p28211681_photo_secure_web.client_projects
  ADD COLUMN IF NOT EXISTS reserve_moved_at TIMESTAMP NULL;