-- Создаём таблицу для отслеживания статуса печати
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.typing_status (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL,
    photographer_id INTEGER NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('client', 'photographer')),
    is_typing BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, photographer_id, sender_type)
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_typing_status_lookup 
ON t_p28211681_photo_secure_web.typing_status(client_id, photographer_id);