CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.yandex_users (
    user_id INTEGER NOT NULL PRIMARY KEY,
    yandex_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NULL,
    full_name VARCHAR(255) NULL,
    avatar_url TEXT NULL,
    is_verified BOOLEAN NULL DEFAULT FALSE,
    raw_profile TEXT NULL,
    registered_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN NULL DEFAULT FALSE,
    blocked_at TIMESTAMP NULL,
    blocked_by VARCHAR(255) NULL,
    block_reason TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    is_active BOOLEAN NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_yandex_users_yandex_id ON t_p28211681_photo_secure_web.yandex_users(yandex_id);
CREATE INDEX IF NOT EXISTS idx_yandex_users_email ON t_p28211681_photo_secure_web.yandex_users(email);