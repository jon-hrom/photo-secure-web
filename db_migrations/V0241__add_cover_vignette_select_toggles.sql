ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
  ADD COLUMN IF NOT EXISTS cover_select_enabled boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vignette_select_enabled boolean NOT NULL DEFAULT FALSE;