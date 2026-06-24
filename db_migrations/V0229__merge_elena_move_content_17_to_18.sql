-- Перенос данных Елены Пономаревой из VK-аккаунта (id=17) в основной Google-аккаунт (id=18)
-- Переносим: фотобанк, папки, клиентов, короткие ссылки на папки

UPDATE t_p28211681_photo_secure_web.photo_folders SET user_id = 18 WHERE user_id = 17;
UPDATE t_p28211681_photo_secure_web.photo_bank SET user_id = 18 WHERE user_id = 17;
UPDATE t_p28211681_photo_secure_web.clients SET user_id = '18', photographer_id = 18 WHERE photographer_id = 17;
UPDATE t_p28211681_photo_secure_web.folder_short_links SET user_id = 18 WHERE user_id = 17;