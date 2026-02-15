ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
  ADD COLUMN IF NOT EXISTS mobile_cover_photo_id INTEGER,
  ADD COLUMN IF NOT EXISTS mobile_cover_focus_x REAL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS mobile_cover_focus_y REAL DEFAULT 0.5;