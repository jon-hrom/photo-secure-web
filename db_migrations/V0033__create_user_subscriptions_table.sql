-- Создание таблицы подписок пользователей на тарифы
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITHOUT TIME ZONE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    payment_method VARCHAR(50) NULL,
    amount_rub NUMERIC(10, 2) NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON t_p28211681_photo_secure_web.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON t_p28211681_photo_secure_web.user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON t_p28211681_photo_secure_web.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_started_at ON t_p28211681_photo_secure_web.user_subscriptions(started_at);

-- Комментарии
COMMENT ON TABLE t_p28211681_photo_secure_web.user_subscriptions IS 'История подписок пользователей на тарифные планы';
COMMENT ON COLUMN t_p28211681_photo_secure_web.user_subscriptions.status IS 'Статус подписки: active, cancelled, expired';
COMMENT ON COLUMN t_p28211681_photo_secure_web.user_subscriptions.started_at IS 'Дата начала подписки';
COMMENT ON COLUMN t_p28211681_photo_secure_web.user_subscriptions.ended_at IS 'Дата окончания подписки (NULL = активна)';
