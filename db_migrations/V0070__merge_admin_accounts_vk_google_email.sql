-- Объединение аккаунтов администратора: VK (user_id=16) + Email/Google (user_id=12)
-- После этой миграции при входе через ЛЮБОЙ провайдер будет использоваться user_id=12

-- Шаг 1: Освобождаем vk_id у дубликата
UPDATE t_p28211681_photo_secure_web.users SET vk_id = NULL WHERE id = 16;

-- Шаг 2: Переносим vk_id на основной аккаунт
UPDATE t_p28211681_photo_secure_web.users SET vk_id = '74713477' WHERE id = 12;

-- Шаг 3: Обновляем vk_users чтобы указывал на основной аккаунт
UPDATE t_p28211681_photo_secure_web.vk_users SET user_id = 12 WHERE vk_sub = '74713477';