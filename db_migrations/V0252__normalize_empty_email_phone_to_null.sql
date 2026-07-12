-- Нормализация пустых email/phone в NULL, чтобы UNIQUE(email) не блокировал вход
-- новых ВК-пользователей без email (VK часто не отдаёт email)
UPDATE t_p28211681_photo_secure_web.users
SET email = NULL
WHERE email IS NOT NULL AND TRIM(email) = '';

UPDATE t_p28211681_photo_secure_web.users
SET phone = NULL
WHERE phone IS NOT NULL AND TRIM(phone) = '';