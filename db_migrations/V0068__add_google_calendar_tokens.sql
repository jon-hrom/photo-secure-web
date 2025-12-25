-- Добавляем колонки для хранения Google Calendar OAuth токенов
ALTER TABLE t_p28211681_photo_secure_web.google_users
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS calendar_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS calendar_scopes TEXT;

-- Комментарии для новых колонок
COMMENT ON COLUMN t_p28211681_photo_secure_web.google_users.access_token IS 'Google OAuth access token для Calendar API';
COMMENT ON COLUMN t_p28211681_photo_secure_web.google_users.refresh_token IS 'Google OAuth refresh token для обновления access_token';
COMMENT ON COLUMN t_p28211681_photo_secure_web.google_users.token_expires_at IS 'Время истечения access_token';
COMMENT ON COLUMN t_p28211681_photo_secure_web.google_users.calendar_enabled IS 'Разрешён ли доступ к Google Calendar';
COMMENT ON COLUMN t_p28211681_photo_secure_web.google_users.calendar_scopes IS 'Предоставленные OAuth scopes для Calendar API';
