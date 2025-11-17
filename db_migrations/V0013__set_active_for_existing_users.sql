-- Устанавливаем is_active = true для всех VK пользователей, которые хотя бы раз заходили
UPDATE vk_users SET is_active = true WHERE last_login IS NOT NULL;

-- Устанавливаем is_active = true для всех обычных пользователей, которые хотя бы раз заходили
UPDATE users SET is_active = true WHERE last_login IS NOT NULL;