ALTER TABLE t_p28211681_photo_secure_web.folder_short_links 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

ALTER TABLE t_p28211681_photo_secure_web.folder_short_links 
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE;