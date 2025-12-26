-- Добавляем VK провайдер в user_emails для основного аккаунта администратора
INSERT INTO t_p28211681_photo_secure_web.user_emails 
(user_id, email, provider, is_primary, is_verified, verified_at, added_at, last_used_at)
VALUES (12, 'jonhrom2012@gmail.com', 'vk', FALSE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email, provider) DO NOTHING;