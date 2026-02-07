-- Добавляем тип срока подписки для промокодов
ALTER TABLE t_p28211681_photo_secure_web.promo_codes 
ADD COLUMN IF NOT EXISTS subscription_duration_type VARCHAR(20) DEFAULT 'fixed_months';

-- Добавляем комментарий для ясности
COMMENT ON COLUMN t_p28211681_photo_secure_web.promo_codes.subscription_duration_type IS 
'Тип срока подписки: fixed_months (N месяцев), until_date (до valid_until), plan_default (стандартный срок тарифа)';

-- Обновляем существующие записи
UPDATE t_p28211681_photo_secure_web.promo_codes 
SET subscription_duration_type = CASE 
    WHEN duration_months IS NOT NULL THEN 'fixed_months'
    ELSE 'plan_default'
END;