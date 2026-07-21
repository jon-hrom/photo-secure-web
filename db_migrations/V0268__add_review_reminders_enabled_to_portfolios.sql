-- Переключатель "Напоминать клиентам об отзыве" в настройках портфолио.
ALTER TABLE t_p28211681_photo_secure_web.portfolios
ADD COLUMN IF NOT EXISTS review_reminders_enabled BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN t_p28211681_photo_secure_web.portfolios.review_reminders_enabled
IS 'Отправлять клиентам напоминание оставить отзыв через 2 дня';