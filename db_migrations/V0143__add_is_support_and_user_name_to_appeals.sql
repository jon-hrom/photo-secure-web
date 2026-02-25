ALTER TABLE t_p28211681_photo_secure_web.blocked_user_appeals
  ADD COLUMN IF NOT EXISTS is_support BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_name VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_appeals_is_support
  ON t_p28211681_photo_secure_web.blocked_user_appeals (is_support, is_read, is_archived);
