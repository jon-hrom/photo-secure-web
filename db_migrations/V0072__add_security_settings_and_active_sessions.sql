-- Добавляем настройки безопасности в app_settings
INSERT INTO t_p28211681_photo_secure_web.app_settings (setting_key, setting_value, description) 
VALUES 
    ('session_timeout_minutes', '7', 'Таймаут сессии в минутах при неактивности'),
    ('jwt_expiration_minutes', '30', 'Время жизни JWT токена в минутах'),
    ('max_login_attempts', '5', 'Максимальное количество неудачных попыток входа'),
    ('lockout_duration_minutes', '15', 'Длительность блокировки после превышения попыток входа'),
    ('session_warning_minutes', '1', 'За сколько минут предупреждать о таймауте сессии')
ON CONFLICT (setting_key) DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;

-- Создаём таблицу активных сессий
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.active_sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    device_id TEXT,
    is_valid BOOLEAN DEFAULT TRUE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON t_p28211681_photo_secure_web.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON t_p28211681_photo_secure_web.active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token_hash ON t_p28211681_photo_secure_web.active_sessions(token_hash);

-- Обновляем таблицу login_attempts (если нужны дополнительные поля)
ALTER TABLE t_p28211681_photo_secure_web.login_attempts 
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMP,
    ADD COLUMN IF NOT EXISTS attempt_type TEXT DEFAULT 'password';

-- Индекс для быстрой проверки блокировок
CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked ON t_p28211681_photo_secure_web.login_attempts(email, is_blocked, blocked_until) 
WHERE is_blocked = TRUE;