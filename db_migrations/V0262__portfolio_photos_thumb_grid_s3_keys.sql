ALTER TABLE t_p28211681_photo_secure_web.portfolio_photos
  ADD COLUMN IF NOT EXISTS thumb_s3_key TEXT,
  ADD COLUMN IF NOT EXISTS grid_s3_key TEXT;