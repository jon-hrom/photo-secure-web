-- Добавляем поля для данных о съёмке в таблицу clients
ALTER TABLE t_p28211681_photo_secure_web.clients
ADD COLUMN IF NOT EXISTS shooting_date DATE,
ADD COLUMN IF NOT EXISTS shooting_time TIME,
ADD COLUMN IF NOT EXISTS shooting_duration INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS shooting_address TEXT,
ADD COLUMN IF NOT EXISTS project_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS project_comments TEXT,
ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP;

COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.shooting_date IS 'Дата съёмки';
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.shooting_time IS 'Время начала съёмки';
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.shooting_duration IS 'Длительность съёмки в часах';
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.shooting_address IS 'Адрес проведения съёмки';
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.project_price IS 'Общая стоимость проекта';
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.project_comments IS 'Комментарии к проекту';
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.google_event_id IS 'ID события в Google Calendar';
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.synced_at IS 'Время последней синхронизации с Google Calendar';