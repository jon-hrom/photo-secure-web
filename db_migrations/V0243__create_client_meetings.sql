-- Таблица встреч с клиентами (client_meetings): параллельна съёмкам (client_projects).
-- Отдельная сущность, чтобы не ломать существующую логику проектов.
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.client_meetings (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES t_p28211681_photo_secure_web.clients(id),
    photographer_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Встреча',
    meeting_date DATE NOT NULL,
    meeting_time TIME WITHOUT TIME ZONE,
    duration INTEGER DEFAULT 60,
    address TEXT,
    description TEXT,
    -- Кастомное доп. напоминание фотографу (по часовому поясу фотографа)
    custom_reminder_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    cancel_reason TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_meetings_client_id ON t_p28211681_photo_secure_web.client_meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_meetings_photographer_id ON t_p28211681_photo_secure_web.client_meetings(photographer_id);
CREATE INDEX IF NOT EXISTS idx_client_meetings_date ON t_p28211681_photo_secure_web.client_meetings(meeting_date);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.meeting_reminders_log (
    id BIGSERIAL PRIMARY KEY,
    meeting_id BIGINT NOT NULL REFERENCES t_p28211681_photo_secure_web.client_meetings(id),
    reminder_type VARCHAR(20) NOT NULL,
    sent_to VARCHAR(20) DEFAULT 'both',
    channel VARCHAR(20) DEFAULT 'both',
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_reminders_log_meeting ON t_p28211681_photo_secure_web.meeting_reminders_log(meeting_id);