-- Привязка Яндекса к главному аккаунту id=12
UPDATE t_p28211681_photo_secure_web.yandex_users
SET user_id = 12
WHERE user_id = 30
  AND NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.yandex_users y2 WHERE y2.user_id = 12);