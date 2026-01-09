CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.vk_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    vk_user_token TEXT NULL,
    vk_group_token TEXT NULL,
    vk_group_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);