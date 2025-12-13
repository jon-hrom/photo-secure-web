-- Таблица для хранения диалогов WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    phone_number VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255),
    last_message_text TEXT,
    last_message_time TIMESTAMP,
    unread_count INTEGER DEFAULT 0,
    is_admin_chat BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, phone_number)
);

-- Таблица для хранения сообщений WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES whatsapp_chats(id),
    message_id VARCHAR(255) UNIQUE,
    sender_phone VARCHAR(20) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    media_url TEXT,
    is_from_me BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'pending',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для настроек уведомлений пользователей
CREATE TABLE IF NOT EXISTS whatsapp_notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    sound_url TEXT DEFAULT '/sounds/notification.mp3',
    desktop_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_user_id ON whatsapp_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone ON whatsapp_chats(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_is_read ON whatsapp_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON whatsapp_messages(message_id);