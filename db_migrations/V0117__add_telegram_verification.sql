-- Добавление полей для обязательной верификации Telegram по номеру телефона

-- Добавляем поля в таблицу users
ALTER TABLE t_p28211681_photo_secure_web.users
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS telegram_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS telegram_verified_at TIMESTAMP;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON t_p28211681_photo_secure_web.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON t_p28211681_photo_secure_web.users(telegram_chat_id);

-- Таблица для кодов верификации
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.telegram_verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON t_p28211681_photo_secure_web.telegram_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON t_p28211681_photo_secure_web.telegram_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON t_p28211681_photo_secure_web.telegram_verification_codes(expires_at);

COMMENT ON TABLE t_p28211681_photo_secure_web.telegram_verification_codes IS 'Коды подтверждения для привязки Telegram по номеру телефона';
COMMENT ON COLUMN t_p28211681_photo_secure_web.users.phone_number IS 'Номер телефона пользователя';
COMMENT ON COLUMN t_p28211681_photo_secure_web.users.telegram_chat_id IS 'Chat ID для отправки уведомлений в Telegram';
COMMENT ON COLUMN t_p28211681_photo_secure_web.users.telegram_verified IS 'Подтверждена ли привязка Telegram';
COMMENT ON COLUMN t_p28211681_photo_secure_web.users.telegram_verified_at IS 'Дата подтверждения привязки Telegram';