-- Деактивируем дубль 17 (объединён в основной аккаунт 18), освобождаем телефон/email
UPDATE t_p28211681_photo_secure_web.users
SET is_active = FALSE,
    is_blocked = TRUE,
    blocked_at = CURRENT_TIMESTAMP,
    blocked_reason = 'merged_into_18',
    phone = NULL,
    phone_verified_at = NULL,
    email = NULL
WHERE id = 17;