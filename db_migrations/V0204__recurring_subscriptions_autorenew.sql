-- Поля автопродления в заказах
ALTER TABLE t_p28211681_photo_secure_web.payment_orders
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_recurring_charge BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_subscription_id INTEGER;

-- Поля автопродления в подписках (фиксация цены оплаченного периода — п.5.6)
ALTER TABLE t_p28211681_photo_secure_web.user_subscriptions
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_price_rub NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS duration_months INTEGER NOT NULL DEFAULT 1;

-- Таблица рекуррентных подписок (одна активная на пользователя)
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.recurring_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 1,
    locked_price_rub NUMERIC(10,2) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    -- InvId первого (родительского) платежа — используется как PreviousInvoiceID для списаний
    first_inv_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, cancelled
    next_charge_at TIMESTAMP NOT NULL,
    last_charged_at TIMESTAMP,
    reminder_sent_for TIMESTAMP, -- на какую дату списания уже отправлено письмо-напоминание
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_subs_user ON t_p28211681_photo_secure_web.recurring_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_subs_next_charge ON t_p28211681_photo_secure_web.recurring_subscriptions(status, next_charge_at);