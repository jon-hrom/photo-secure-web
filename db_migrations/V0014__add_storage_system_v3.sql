ALTER TABLE t_p28211681_photo_secure_web.users ADD COLUMN IF NOT EXISTS plan_id INTEGER;
ALTER TABLE t_p28211681_photo_secure_web.users ADD COLUMN IF NOT EXISTS custom_quota_gb NUMERIC(10,3);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.storage_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    quota_gb NUMERIC(10,3) NOT NULL,
    monthly_price_rub NUMERIC(10,2) NOT NULL,
    features_json TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.storage_objects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    key VARCHAR(500) NOT NULL,
    bytes BIGINT NOT NULL,
    mime VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storage_objects_user_status ON t_p28211681_photo_secure_web.storage_objects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_storage_objects_key ON t_p28211681_photo_secure_web.storage_objects(key);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.storage_usage_daily (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    used_gb_end_of_day NUMERIC(10,3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_user_date ON t_p28211681_photo_secure_web.storage_usage_daily(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_daily_unique ON t_p28211681_photo_secure_web.storage_usage_daily(user_id, date);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.storage_invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    period VARCHAR(7) NOT NULL,
    gb_day_sum NUMERIC(12,3),
    avg_gb NUMERIC(10,3) NOT NULL,
    rate_rub_per_gb_month NUMERIC(10,2) NOT NULL,
    amount_rub NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_period ON t_p28211681_photo_secure_web.storage_invoices(user_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_user_period ON t_p28211681_photo_secure_web.storage_invoices(user_id, period);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.storage_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);