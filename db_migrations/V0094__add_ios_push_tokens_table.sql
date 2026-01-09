-- Таблица для хранения iOS push-токенов пользователей
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.ios_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_token VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES t_p28211681_photo_secure_web.users(id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_ios_tokens_user_id ON t_p28211681_photo_secure_web.ios_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ios_tokens_active ON t_p28211681_photo_secure_web.ios_push_tokens(is_active);

-- Таблица для логирования отправленных push-уведомлений
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.push_notifications_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_token VARCHAR(255),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    body TEXT,
    payload JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    related_project_id BIGINT,
    related_client_id BIGINT,
    FOREIGN KEY (user_id) REFERENCES t_p28211681_photo_secure_web.users(id)
);

-- Индексы для аналитики
CREATE INDEX IF NOT EXISTS idx_push_log_user_id ON t_p28211681_photo_secure_web.push_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_log_type ON t_p28211681_photo_secure_web.push_notifications_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_push_log_status ON t_p28211681_photo_secure_web.push_notifications_log(status);
CREATE INDEX IF NOT EXISTS idx_push_log_sent_at ON t_p28211681_photo_secure_web.push_notifications_log(sent_at);

COMMENT ON TABLE t_p28211681_photo_secure_web.ios_push_tokens IS 'iOS устройства пользователей с push-токенами для уведомлений';
COMMENT ON TABLE t_p28211681_photo_secure_web.push_notifications_log IS 'История отправки push-уведомлений для аналитики и отладки';
