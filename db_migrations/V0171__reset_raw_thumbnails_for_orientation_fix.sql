-- Сброс thumbnail_s3_key для всех RAW-фото, чтобы перегенерировались
-- с правильной ориентацией (после фикса в generate-thumbnail).
UPDATE photo_bank
SET thumbnail_s3_key = NULL,
    thumbnail_s3_url = NULL
WHERE is_trashed = FALSE
  AND thumbnail_s3_key IS NOT NULL
  AND (is_raw = TRUE OR LOWER(file_name) ~ '\.(cr2|cr3|nef|arw|dng|orf|rw2|raw|raf)$');
