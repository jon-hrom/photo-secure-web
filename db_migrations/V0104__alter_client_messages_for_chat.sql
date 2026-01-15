-- Добавляем недостающие поля для системы чата
ALTER TABLE client_messages 
ADD COLUMN IF NOT EXISTS photographer_id INTEGER REFERENCES users(id);

ALTER TABLE client_messages 
ADD COLUMN IF NOT EXISTS sender_type VARCHAR(20) CHECK (sender_type IN ('client', 'photographer'));

ALTER TABLE client_messages 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Создаем индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_client_messages_photographer_id ON client_messages(photographer_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_sender_type ON client_messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_client_messages_unread ON client_messages(is_read) WHERE is_read = FALSE;