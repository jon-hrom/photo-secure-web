ALTER TABLE t_p28211681_photo_secure_web.client_projects
  ADD COLUMN IF NOT EXISTS photobook_count integer,
  ADD COLUMN IF NOT EXISTS photobook_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS photo_items jsonb;