-- Добавляем поле is_active в таблицу vk_users
ALTER TABLE vk_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Добавляем поля для блокировки пользователей
ALTER TABLE vk_users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE vk_users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
ALTER TABLE vk_users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Добавляем поля для отслеживания активности
ALTER TABLE vk_users ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE vk_users ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Устанавливаем is_active = true для всех существующих пользователей VK
UPDATE vk_users SET is_active = true WHERE is_active IS NULL;