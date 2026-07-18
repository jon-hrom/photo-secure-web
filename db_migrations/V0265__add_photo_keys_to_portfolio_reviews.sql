ALTER TABLE t_p28211681_photo_secure_web.portfolio_reviews
  ADD COLUMN IF NOT EXISTS photo_keys JSONB NOT NULL DEFAULT '[]'::jsonb;