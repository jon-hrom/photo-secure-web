-- Таблица для блокировки IP адресов
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.ip_blacklist (
    ip_address TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP,
    is_permanent BOOLEAN DEFAULT FALSE,
    failed_attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP,
    created_by TEXT DEFAULT 'system'
);

-- Таблица для Rate Limiting
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.rate_limits (
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ip_address, endpoint, window_start)
);

-- Таблица для Refresh Tokens
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.refresh_tokens (
    token_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    revoked_at TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT TRUE
);

-- Таблица для логов безопасности
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.security_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    user_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_expires ON t_p28211681_photo_secure_web.ip_blacklist(blocked_until) WHERE is_permanent = FALSE;
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON t_p28211681_photo_secure_web.rate_limits(ip_address, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON t_p28211681_photo_secure_web.refresh_tokens(user_id, is_valid);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON t_p28211681_photo_secure_web.refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created ON t_p28211681_photo_secure_web.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON t_p28211681_photo_secure_web.security_logs(event_type, severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_user ON t_p28211681_photo_secure_web.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON t_p28211681_photo_secure_web.security_logs(ip_address);

-- Настройки Rate Limiting
INSERT INTO t_p28211681_photo_secure_web.app_settings (setting_key, setting_value, description)
VALUES 
    ('rate_limit_requests', '100', 'Максимум запросов с одного IP в минуту'),
    ('rate_limit_window_seconds', '60', 'Временное окно для подсчёта запросов (секунды)'),
    ('ip_block_threshold', '50', 'Количество неудачных попыток для блокировки IP'),
    ('ip_block_duration_hours', '24', 'Длительность блокировки IP в часах'),
    ('refresh_token_expiration_days', '30', 'Время жизни refresh token в днях')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;