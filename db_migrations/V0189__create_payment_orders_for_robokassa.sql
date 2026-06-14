CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.payment_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 1,
    user_email VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    robokassa_inv_id BIGINT UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    payment_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_inv_id ON t_p28211681_photo_secure_web.payment_orders(robokassa_inv_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON t_p28211681_photo_secure_web.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON t_p28211681_photo_secure_web.payment_orders(user_id);