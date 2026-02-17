ALTER TABLE t_p28211681_photo_secure_web.favorite_clients
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

ALTER TABLE t_p28211681_photo_secure_web.favorite_clients
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NULL;