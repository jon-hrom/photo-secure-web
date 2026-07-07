-- Добавляем недостающие колонки в vk_settings (код vk-settings уже их использует)
ALTER TABLE t_p28211681_photo_secure_web.vk_settings
  ADD COLUMN IF NOT EXISTS vk_user_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vk_user_id VARCHAR(255);

-- Числовой VK ID клиента для отправки личных сообщений и флаг разрешения сообщений
ALTER TABLE t_p28211681_photo_secure_web.clients
  ADD COLUMN IF NOT EXISTS vk_client_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vk_messages_allowed BOOLEAN DEFAULT FALSE;
