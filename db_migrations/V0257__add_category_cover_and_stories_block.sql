ALTER TABLE t_p28211681_photo_secure_web.portfolio_categories
  ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '';

ALTER TABLE t_p28211681_photo_secure_web.portfolios
  ADD COLUMN IF NOT EXISTS show_stories_block BOOLEAN DEFAULT TRUE;