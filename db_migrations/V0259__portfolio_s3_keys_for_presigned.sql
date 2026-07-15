ALTER TABLE t_p28211681_photo_secure_web.portfolio_photos ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE t_p28211681_photo_secure_web.portfolios ADD COLUMN IF NOT EXISTS avatar_s3_key TEXT;
ALTER TABLE t_p28211681_photo_secure_web.portfolios ADD COLUMN IF NOT EXISTS cover_s3_key TEXT;