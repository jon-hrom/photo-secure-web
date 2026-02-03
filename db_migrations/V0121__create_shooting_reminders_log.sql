-- Таблица для отслеживания отправленных напоминаний о съёмках
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.shooting_reminders_log (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES t_p28211681_photo_secure_web.client_projects(id),
    reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('24h', '5h', '1h')),
    sent_to VARCHAR(20) NOT NULL CHECK (sent_to IN ('client', 'photographer', 'both')),
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'both')),
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    UNIQUE(project_id, reminder_type, sent_to)
);

CREATE INDEX idx_shooting_reminders_project ON t_p28211681_photo_secure_web.shooting_reminders_log(project_id);
CREATE INDEX idx_shooting_reminders_type ON t_p28211681_photo_secure_web.shooting_reminders_log(reminder_type);

COMMENT ON TABLE t_p28211681_photo_secure_web.shooting_reminders_log IS 'Лог отправленных напоминаний о съёмках';
COMMENT ON COLUMN t_p28211681_photo_secure_web.shooting_reminders_log.reminder_type IS 'Тип напоминания: 24h (за сутки), 5h (за 5 часов), 1h (за час)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.shooting_reminders_log.sent_to IS 'Кому отправлено: client, photographer или both';