-- Добавляем поле favorite_config для хранения настроек избранного
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links 
ADD COLUMN IF NOT EXISTS favorite_config JSONB DEFAULT NULL;

COMMENT ON COLUMN t_p28211681_photo_secure_web.folder_short_links.favorite_config IS 'Настройки избранного: {id, name, fields: {fullName, phone, email}}';