-- Таблица для учёта загруженных файлов фотографами
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.uploads (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  shoot_id BIGINT,
  s3_key TEXT NOT NULL UNIQUE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'uploaded',
  orig_filename TEXT,
  size_bytes BIGINT,
  content_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON t_p28211681_photo_secure_web.uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_shoot_id ON t_p28211681_photo_secure_web.uploads(shoot_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON t_p28211681_photo_secure_web.uploads(status);

COMMENT ON TABLE t_p28211681_photo_secure_web.uploads IS 'Загруженные фотографами файлы через мобильный upload';
COMMENT ON COLUMN t_p28211681_photo_secure_web.uploads.shoot_id IS 'ID съёмки (необязательно, можно группировать загрузки)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.uploads.s3_key IS 'Ключ файла в S3 хранилище';
COMMENT ON COLUMN t_p28211681_photo_secure_web.uploads.status IS 'Статус: uploaded, processing, ready, failed';