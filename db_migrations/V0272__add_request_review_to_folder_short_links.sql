ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
ADD COLUMN IF NOT EXISTS request_review BOOLEAN DEFAULT TRUE;