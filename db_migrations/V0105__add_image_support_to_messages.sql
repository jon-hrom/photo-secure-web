-- Добавляем поле для хранения URL изображений в сообщениях
ALTER TABLE t_p28211681_photo_secure_web.client_messages 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Добавляем индекс для быстрого поиска непрочитанных сообщений
CREATE INDEX IF NOT EXISTS idx_client_messages_unread 
ON t_p28211681_photo_secure_web.client_messages(photographer_id, is_read) 
WHERE is_read = FALSE;