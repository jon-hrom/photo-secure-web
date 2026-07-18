ALTER TABLE t_p28211681_photo_secure_web.portfolio_reviews
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shooting_style TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'photographer';

CREATE INDEX IF NOT EXISTS idx_portfolio_reviews_approved
  ON t_p28211681_photo_secure_web.portfolio_reviews (portfolio_id, is_approved);