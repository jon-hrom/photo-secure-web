-- Добавляем поля для встреч с клиентами
ALTER TABLE t_p28211681_photo_secure_web.meetings 
ADD COLUMN IF NOT EXISTS client_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS client_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'scheduled';

-- Создаем индекс для быстрого поиска встреч пользователя
CREATE INDEX IF NOT EXISTS idx_meetings_creator_date ON t_p28211681_photo_secure_web.meetings(creator_id, meeting_date);

-- Создаем индекс для поиска по статусу
CREATE INDEX IF NOT EXISTS idx_meetings_status ON t_p28211681_photo_secure_web.meetings(status);