-- Добавляем поля для промокодов и оплаты в user_subscriptions
ALTER TABLE t_p28211681_photo_secure_web.user_subscriptions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS promo_code_id INTEGER,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_paid_rub NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';

-- Обновляем expires_at для существующих записей (если ended_at указан)
UPDATE t_p28211681_photo_secure_web.user_subscriptions 
SET expires_at = ended_at 
WHERE expires_at IS NULL AND ended_at IS NOT NULL;

-- Обновляем price_paid_rub для существующих записей
UPDATE t_p28211681_photo_secure_web.user_subscriptions 
SET price_paid_rub = amount_rub 
WHERE price_paid_rub = 0 AND amount_rub IS NOT NULL;