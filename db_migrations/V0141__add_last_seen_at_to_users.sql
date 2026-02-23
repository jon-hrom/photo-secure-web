ALTER TABLE t_p28211681_photo_secure_web.users
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at 
ON t_p28211681_photo_secure_web.users(last_seen_at);