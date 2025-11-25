-- Таблица для хранения обращений от заблокированных пользователей
CREATE TABLE IF NOT EXISTS blocked_user_appeals (
    id SERIAL PRIMARY KEY,
    user_identifier VARCHAR(500) NOT NULL,
    user_email VARCHAR(255),
    user_phone VARCHAR(50),
    auth_method VARCHAR(50),
    message TEXT NOT NULL,
    block_reason TEXT,
    is_blocked BOOLEAN DEFAULT true,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    admin_response TEXT,
    responded_at TIMESTAMP
);

-- Индекс для быстрого поиска непрочитанных обращений
CREATE INDEX idx_appeals_unread ON blocked_user_appeals(is_read, created_at DESC);

-- Индекс для поиска по пользователю
CREATE INDEX idx_appeals_user ON blocked_user_appeals(user_identifier);