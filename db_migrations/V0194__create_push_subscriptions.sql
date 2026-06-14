CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_identifier VARCHAR(255) NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITHOUT TIME ZONE NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON t_p28211681_photo_secure_web.push_subscriptions (user_identifier);