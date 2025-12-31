-- Добавляем поля для хранения миниатюр RAW файлов
ALTER TABLE photo_bank 
ADD COLUMN IF NOT EXISTS thumbnail_s3_key TEXT,
ADD COLUMN IF NOT EXISTS is_raw BOOLEAN DEFAULT FALSE;

-- Индекс для поиска RAW файлов без превью
CREATE INDEX IF NOT EXISTS idx_photo_bank_raw_no_thumbnail 
ON photo_bank(user_id, is_raw) 
WHERE is_raw = TRUE AND thumbnail_s3_key IS NULL;