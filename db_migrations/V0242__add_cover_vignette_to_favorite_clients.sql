ALTER TABLE t_p28211681_photo_secure_web.favorite_clients
  ADD COLUMN IF NOT EXISTS cover_photo_id integer NULL,
  ADD COLUMN IF NOT EXISTS vignette_photo_id integer NULL;