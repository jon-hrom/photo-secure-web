-- Добавляем поля для управления техническим браком в папках фотобанка

-- Добавляем поле folder_type для различения типа папки (originals/tech_rejects)
ALTER TABLE t_p28211681_photo_secure_web.photo_folders 
ADD COLUMN IF NOT EXISTS folder_type VARCHAR(50) DEFAULT 'originals';

-- Добавляем поле parent_folder_id для связи подпапок с родительской папкой
ALTER TABLE t_p28211681_photo_secure_web.photo_folders 
ADD COLUMN IF NOT EXISTS parent_folder_id INTEGER;

-- Добавляем индекс для быстрого поиска подпапок
CREATE INDEX IF NOT EXISTS idx_photo_folders_parent_folder_id 
ON t_p28211681_photo_secure_web.photo_folders(parent_folder_id);

-- Добавляем поле tech_reject_reason для хранения причины отклонения фото
ALTER TABLE t_p28211681_photo_secure_web.photo_bank 
ADD COLUMN IF NOT EXISTS tech_reject_reason TEXT;

-- Добавляем поле tech_analyzed для отметки проанализированных фото
ALTER TABLE t_p28211681_photo_secure_web.photo_bank 
ADD COLUMN IF NOT EXISTS tech_analyzed BOOLEAN DEFAULT FALSE;

-- Добавляем индекс для быстрого поиска неанализированных фото
CREATE INDEX IF NOT EXISTS idx_photo_bank_tech_analyzed 
ON t_p28211681_photo_secure_web.photo_bank(folder_id, tech_analyzed);

-- Комментарии для документирования
COMMENT ON COLUMN t_p28211681_photo_secure_web.photo_folders.folder_type IS 'Тип папки: originals (оригиналы), tech_rejects (технический брак)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.photo_folders.parent_folder_id IS 'ID родительской папки для подпапок (null для основных папок)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.photo_bank.tech_reject_reason IS 'Причина отклонения фото (blur, overexposed, underexposed, noise, etc.)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.photo_bank.tech_analyzed IS 'Флаг, было ли фото проанализировано на технический брак';