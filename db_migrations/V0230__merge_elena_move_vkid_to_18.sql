-- Освобождаем vk_id у дубля 17 и переносим на основной аккаунт 18
UPDATE t_p28211681_photo_secure_web.users SET vk_id = NULL WHERE id = 17;
UPDATE t_p28211681_photo_secure_web.users SET vk_id = '77245770' WHERE id = 18 AND vk_id IS NULL;