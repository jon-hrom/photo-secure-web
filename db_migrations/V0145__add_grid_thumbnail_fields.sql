ALTER TABLE t_p28211681_photo_secure_web.photo_bank
  ADD COLUMN IF NOT EXISTS grid_thumbnail_s3_key TEXT,
  ADD COLUMN IF NOT EXISTS grid_thumbnail_s3_url TEXT;