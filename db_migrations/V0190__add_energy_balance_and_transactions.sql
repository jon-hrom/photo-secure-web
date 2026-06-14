ALTER TABLE t_p28211681_photo_secure_web.users
ADD COLUMN IF NOT EXISTS energy_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.energy_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'topup',
    rub_amount DECIMAL(10, 2),
    order_id INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_energy_tx_user ON t_p28211681_photo_secure_web.energy_transactions(user_id);

ALTER TABLE t_p28211681_photo_secure_web.payment_orders
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'tariff',
ADD COLUMN IF NOT EXISTS energy_amount INTEGER;