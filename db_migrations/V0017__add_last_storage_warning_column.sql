ALTER TABLE t_p28211681_photo_secure_web.users 
ADD COLUMN IF NOT EXISTS last_storage_warning_at TIMESTAMP;

COMMENT ON COLUMN t_p28211681_photo_secure_web.users.last_storage_warning_at IS 'Timestamp of last storage warning email sent to user';