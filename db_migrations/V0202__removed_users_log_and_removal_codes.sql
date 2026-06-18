CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.removed_users_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    source VARCHAR(20),
    registered_at TIMESTAMP,
    removed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_by VARCHAR(20) NOT NULL DEFAULT 'user',
    photos_count INTEGER NOT NULL DEFAULT 0,
    storage_freed_bytes BIGINT NOT NULL DEFAULT 0,
    ip_address VARCHAR(45),
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_removed_users_log_removed_at ON t_p28211681_photo_secure_web.removed_users_log(removed_at DESC);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.account_removal_codes (
    user_id INTEGER PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);