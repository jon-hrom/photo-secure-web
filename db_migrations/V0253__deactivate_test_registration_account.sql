-- Деактивация тестового аккаунта, созданного при проверке валидации регистрации
UPDATE t_p28211681_photo_secure_web.users
SET is_active = FALSE, approval_status = 'rejected'
WHERE email = 'realname@mail.ru' AND id = 40;