-- Создание таблицы промокодов
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL,
    duration_months INTEGER DEFAULT NULL,
    max_uses INTEGER DEFAULT NULL,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP DEFAULT NULL,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    description TEXT
);

-- Создание таблицы применённых промокодов
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.promo_code_usages (
    id SERIAL PRIMARY KEY,
    promo_code_id INTEGER,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER,
    applied_at TIMESTAMP DEFAULT NOW(),
    discount_amount NUMERIC(10, 2) NOT NULL,
    original_price NUMERIC(10, 2) NOT NULL,
    final_price NUMERIC(10, 2) NOT NULL
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON t_p28211681_photo_secure_web.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_code_usages_user_id ON t_p28211681_photo_secure_web.promo_code_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usages_promo_code_id ON t_p28211681_photo_secure_web.promo_code_usages(promo_code_id);

COMMENT ON TABLE t_p28211681_photo_secure_web.promo_codes IS 'Промокоды для скидок на тарифы';
COMMENT ON TABLE t_p28211681_photo_secure_web.promo_code_usages IS 'История применения промокодов пользователями';