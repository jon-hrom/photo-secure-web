-- Добавляем поля для гибкой настройки статистики в тарифных планах
ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS stats_enabled BOOLEAN DEFAULT true;

-- Поля для отслеживания различных метрик
ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS track_storage_usage BOOLEAN DEFAULT true;

ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS track_client_count BOOLEAN DEFAULT true;

ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS track_booking_analytics BOOLEAN DEFAULT true;

ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS track_revenue BOOLEAN DEFAULT true;

ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS track_upload_history BOOLEAN DEFAULT true;

ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS track_download_stats BOOLEAN DEFAULT true;

-- Обновляем существующие тарифы - базовые тарифы имеют ограниченную статистику
UPDATE t_p28211681_photo_secure_web.storage_plans 
SET 
  track_storage_usage = true,
  track_client_count = true,
  track_booking_analytics = CASE WHEN name IN ('Профи', 'Бизнес') THEN true ELSE false END,
  track_revenue = CASE WHEN name IN ('Базовый', 'Профи', 'Бизнес') THEN true ELSE false END,
  track_upload_history = CASE WHEN name IN ('Профи', 'Бизнес') THEN true ELSE false END,
  track_download_stats = CASE WHEN name IN ('Бизнес') THEN true ELSE false END,
  stats_enabled = true
WHERE name IN ('Старт', 'Базовый', 'Профи', 'Бизнес');