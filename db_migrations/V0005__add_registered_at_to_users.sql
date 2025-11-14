ALTER TABLE t_p28211681_photo_secure_web.users 
ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE t_p28211681_photo_secure_web.users 
SET registered_at = created_at 
WHERE registered_at IS NULL;