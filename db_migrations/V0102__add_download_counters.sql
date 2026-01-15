-- Добавление счётчиков скачиваний для папок и фотографий

-- Добавляем счётчик скачиваний архива для папок
ALTER TABLE t_p28211681_photo_secure_web.photo_folders 
ADD COLUMN IF NOT EXISTS archive_download_count INTEGER DEFAULT 0;

-- Добавляем счётчик скачиваний для отдельных фотографий
ALTER TABLE t_p28211681_photo_secure_web.photo_bank 
ADD COLUMN IF NOT EXISTS photo_download_count INTEGER DEFAULT 0;

-- Создаём индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_photo_folders_download_count 
ON t_p28211681_photo_secure_web.photo_folders(archive_download_count);

CREATE INDEX IF NOT EXISTS idx_photo_bank_download_count 
ON t_p28211681_photo_secure_web.photo_bank(photo_download_count);
