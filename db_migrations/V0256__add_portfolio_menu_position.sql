ALTER TABLE t_p28211681_photo_secure_web.portfolios
  ADD COLUMN IF NOT EXISTS menu_position VARCHAR(20) DEFAULT 'top-right',
  ADD COLUMN IF NOT EXISTS logo_text VARCHAR(120) DEFAULT '';