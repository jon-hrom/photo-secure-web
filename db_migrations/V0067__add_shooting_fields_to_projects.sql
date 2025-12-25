-- Добавляем поля для данных о съёмке в таблицу client_projects
ALTER TABLE t_p28211681_photo_secure_web.client_projects
ADD COLUMN IF NOT EXISTS shooting_time TIME,
ADD COLUMN IF NOT EXISTS shooting_duration INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS shooting_address TEXT,
ADD COLUMN IF NOT EXISTS add_to_calendar BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP;

COMMENT ON COLUMN t_p28211681_photo_secure_web.client_projects.shooting_time IS 'Время начала съёмки';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_projects.shooting_duration IS 'Длительность съёмки в часах';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_projects.shooting_address IS 'Адрес проведения съёмки';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_projects.add_to_calendar IS 'Добавить в Google Calendar';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_projects.google_event_id IS 'ID события в Google Calendar';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_projects.synced_at IS 'Время последней синхронизации с Google Calendar';