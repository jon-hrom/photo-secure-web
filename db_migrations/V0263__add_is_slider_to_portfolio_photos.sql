ALTER TABLE t_p28211681_photo_secure_web.portfolio_photos
ADD COLUMN IF NOT EXISTS is_slider BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_portfolio_photos_slider
ON t_p28211681_photo_secure_web.portfolio_photos (portfolio_id, is_slider);