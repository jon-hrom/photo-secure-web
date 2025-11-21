-- Добавление индивидуальной квоты в подписки
ALTER TABLE t_p28211681_photo_secure_web.user_subscriptions 
ADD COLUMN IF NOT EXISTS custom_quota_gb NUMERIC(10, 2) NULL;

COMMENT ON COLUMN t_p28211681_photo_secure_web.user_subscriptions.custom_quota_gb IS 'Индивидуальная квота для пользователя (перезаписывает квоту из тарифа)';
