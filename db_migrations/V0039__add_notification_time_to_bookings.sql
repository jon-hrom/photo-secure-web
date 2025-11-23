-- Добавляем поле notification_time (время отправки уведомления в часах до встречи)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notification_time INTEGER DEFAULT 24;

COMMENT ON COLUMN bookings.notification_time IS 'За сколько часов до встречи отправить уведомление (1, 2, 3, 6, 24, 48, 168)';
