-- Обнулить expires_at у всех активных подписок на бесплатный тариф (Старт, plan_id=1)
UPDATE t_p28211681_photo_secure_web.user_subscriptions
SET expires_at = NULL, updated_at = CURRENT_TIMESTAMP
WHERE plan_id = 1 AND status = 'active';

-- Пометить устаревшие платные подписки как expired, если expires_at уже прошла
UPDATE t_p28211681_photo_secure_web.user_subscriptions
SET status = 'expired', updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < CURRENT_TIMESTAMP
  AND plan_id != 1;