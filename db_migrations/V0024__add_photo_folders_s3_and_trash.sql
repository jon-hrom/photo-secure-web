-- Обновление таблицы photo_folders для работы с S3
ALTER TABLE photo_folders ADD COLUMN IF NOT EXISTS s3_prefix TEXT;
ALTER TABLE photo_folders ADD COLUMN IF NOT EXISTS is_trashed BOOLEAN DEFAULT FALSE;
ALTER TABLE photo_folders ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_photo_folders_s3_prefix ON photo_folders(s3_prefix);
CREATE INDEX IF NOT EXISTS idx_photo_folders_trashed ON photo_folders(is_trashed, trashed_at);

-- Обновление таблицы photo_bank для S3
ALTER TABLE photo_bank ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE photo_bank ADD COLUMN IF NOT EXISTS s3_url TEXT;
ALTER TABLE photo_bank ADD COLUMN IF NOT EXISTS is_trashed BOOLEAN DEFAULT FALSE;
ALTER TABLE photo_bank ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_photo_bank_s3_key ON photo_bank(s3_key);
CREATE INDEX IF NOT EXISTS idx_photo_bank_trashed ON photo_bank(is_trashed, trashed_at);

COMMENT ON COLUMN photo_folders.s3_prefix IS 'S3 prefix: photobank/{user_id}/{folder_id}/';
COMMENT ON COLUMN photo_folders.is_trashed IS 'Папка в корзине (S3: trash/photobank/{user_id}/{folder_id}/)';
COMMENT ON COLUMN photo_bank.s3_key IS 'S3 key: photobank/{user_id}/{folder_id}/{uuid}.{ext}';
COMMENT ON COLUMN photo_bank.is_trashed IS 'Файл в корзине (S3: trash/{original_key})';