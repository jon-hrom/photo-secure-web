-- Добавляем поля для отслеживания статуса доставки автоматических сообщений клиенту
ALTER TABLE t_p28211681_photo_secure_web.client_messages
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_error TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_message_id VARCHAR(255) DEFAULT NULL;

COMMENT ON COLUMN t_p28211681_photo_secure_web.client_messages.delivery_status IS 'Статус доставки: pending, sent, delivered, read, failed, unknown';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_messages.delivery_error IS 'Текст ошибки если не удалось доставить';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_messages.external_message_id IS 'ID сообщения во внешнем сервисе (idMessage GREEN-API, message_id Telegram)';

CREATE INDEX IF NOT EXISTS idx_client_messages_delivery_status
  ON t_p28211681_photo_secure_web.client_messages(delivery_status)
  WHERE delivery_status IS NOT NULL;