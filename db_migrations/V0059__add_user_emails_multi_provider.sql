-- Таблица для хранения множественных email-адресов пользователей
-- Поддержка разных провайдеров (email/password, Google, VK, Яндекс)

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.user_emails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p28211681_photo_secure_web.users(id),
    email VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'email', 'google', 'vk', 'yandex'
    is_primary BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    UNIQUE(email, provider),
    CONSTRAINT valid_provider CHECK (provider IN ('email', 'google', 'vk', 'yandex'))
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON t_p28211681_photo_secure_web.user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_email ON t_p28211681_photo_secure_web.user_emails(email);
CREATE INDEX IF NOT EXISTS idx_user_emails_primary ON t_p28211681_photo_secure_web.user_emails(user_id, is_primary) WHERE is_primary = TRUE;

-- Миграция существующих данных: перенос email из users в user_emails
INSERT INTO t_p28211681_photo_secure_web.user_emails (user_id, email, provider, is_primary, is_verified, verified_at, added_at)
SELECT 
    id,
    email,
    COALESCE(source, 'email') as provider,
    TRUE as is_primary,
    (email_verified_at IS NOT NULL) as is_verified,
    email_verified_at,
    COALESCE(created_at, CURRENT_TIMESTAMP) as added_at
FROM t_p28211681_photo_secure_web.users
WHERE email IS NOT NULL AND email != ''
ON CONFLICT (email, provider) DO NOTHING;

-- Миграция Google users: добавляем их email как google провайдер
INSERT INTO t_p28211681_photo_secure_web.user_emails (user_id, email, provider, is_primary, is_verified, verified_at, added_at, last_used_at)
SELECT 
    user_id,
    email,
    'google' as provider,
    FALSE as is_primary, -- не делаем primary, если уже есть email
    is_verified,
    CASE WHEN is_verified THEN registered_at ELSE NULL END as verified_at,
    registered_at as added_at,
    last_login as last_used_at
FROM t_p28211681_photo_secure_web.google_users
WHERE email IS NOT NULL AND email != ''
ON CONFLICT (email, provider) DO NOTHING;