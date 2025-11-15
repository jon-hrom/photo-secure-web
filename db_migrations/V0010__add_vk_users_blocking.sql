-- Добавляем поля блокировки для VK пользователей
ALTER TABLE t_p28211681_photo_secure_web.vk_users 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT;