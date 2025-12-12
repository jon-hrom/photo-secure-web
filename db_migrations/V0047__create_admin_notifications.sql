-- Таблица для уведомлений в админ-панель
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.admin_messages (
    id SERIAL PRIMARY KEY,
    message_type VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL
);

CREATE INDEX idx_admin_messages_created ON t_p28211681_photo_secure_web.admin_messages(created_at DESC);
CREATE INDEX idx_admin_messages_read ON t_p28211681_photo_secure_web.admin_messages(is_read);

-- Таблица для отслеживания уведомлений о балансе SMS
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.sms_balance_alerts (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_notification_at TIMESTAMP NOT NULL,
    balance NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row_check CHECK (id = 1)
);

COMMENT ON TABLE t_p28211681_photo_secure_web.admin_messages IS 'Системные уведомления для администраторов';
COMMENT ON TABLE t_p28211681_photo_secure_web.sms_balance_alerts IS 'Отслеживание последнего уведомления о низком балансе SMS (только одна запись)';