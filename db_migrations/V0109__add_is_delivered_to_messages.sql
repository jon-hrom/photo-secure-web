-- Добавляем поле is_delivered для отслеживания доставки сообщений
ALTER TABLE t_p28211681_photo_secure_web.client_messages 
ADD COLUMN IF NOT EXISTS is_delivered boolean DEFAULT false;

-- Устанавливаем is_delivered = true для всех существующих сообщений
UPDATE t_p28211681_photo_secure_web.client_messages 
SET is_delivered = true;

COMMENT ON COLUMN t_p28211681_photo_secure_web.client_messages.is_delivered IS 'Флаг доставки сообщения (получатель открыл чат)';