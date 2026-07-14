CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.portfolio_shootings (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  cover_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_shootings_cat
  ON t_p28211681_photo_secure_web.portfolio_shootings(category_id);

ALTER TABLE t_p28211681_photo_secure_web.portfolio_photos
  ADD COLUMN IF NOT EXISTS shooting_id INTEGER NULL;