
ALTER TABLE t_p28211681_photo_secure_web.photo_folders
ADD COLUMN IF NOT EXISTS password_hash text NULL,
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
