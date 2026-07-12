-- Исправление аккаунта фотографа id=32: в поле email был вписан телефон.
-- Телефон уже сохранён в users.phone. Очищаем некорректный email, чтобы
-- фотограф мог указать настоящую почту в настройках.

UPDATE t_p28211681_photo_secure_web.users
SET email = NULL,
    email_verified_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 32 AND email = '+79171264686';

UPDATE t_p28211681_photo_secure_web.user_emails
SET email = 'invalid-32@removed.local',
    is_primary = FALSE,
    is_verified = FALSE
WHERE id = 151 AND email = '+79171264686';