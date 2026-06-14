CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.energy_promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
    discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    bonus_energy INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_until TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.energy_promo_usages (
    id SERIAL PRIMARY KEY,
    promo_code_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_energy_promo_usages_user ON t_p28211681_photo_secure_web.energy_promo_usages(user_id, promo_code_id);

ALTER TABLE t_p28211681_photo_secure_web.payment_orders
ADD COLUMN IF NOT EXISTS energy_promo_code_id INTEGER;