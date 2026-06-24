-- Деактивируем пустые дубли (16=vk, 24=telegram, 30=yandex), объединённые в аккаунт 12.
-- Освобождаем телефон/email, чтобы они не мешали идентификации главного аккаунта.
UPDATE t_p28211681_photo_secure_web.users
SET is_active = FALSE,
    is_blocked = TRUE,
    blocked_at = CURRENT_TIMESTAMP,
    blocked_reason = 'merged_into_12',
    phone = NULL,
    phone_verified_at = NULL,
    email = NULL,
    telegram_id = NULL,
    telegram_chat_id = NULL,
    telegram_verified = FALSE
WHERE id IN (16, 24, 30);