-- Добавление поддержки видео файлов в photo_bank

ALTER TABLE photo_bank 
ADD COLUMN IF NOT EXISTS is_video BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) DEFAULT 'image/jpeg',
ADD COLUMN IF NOT EXISTS thumbnail_s3_url TEXT;

-- Обновляем content_type для существующих записей
UPDATE photo_bank 
SET content_type = 'image/jpeg' 
WHERE content_type IS NULL AND is_video = FALSE;

-- Индексы для быстрого поиска видео
CREATE INDEX IF NOT EXISTS idx_photo_bank_is_video ON photo_bank(is_video) WHERE is_video = TRUE;
CREATE INDEX IF NOT EXISTS idx_photo_bank_content_type ON photo_bank(content_type);

COMMENT ON COLUMN photo_bank.is_video IS 'Флаг указывающий что файл является видео';
COMMENT ON COLUMN photo_bank.content_type IS 'MIME-тип файла (image/jpeg, video/mp4, и т.д.)';
COMMENT ON COLUMN photo_bank.thumbnail_s3_url IS 'URL превью для видео файлов в S3';
