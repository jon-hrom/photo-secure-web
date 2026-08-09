CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.vk_accounts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '',
    kind VARCHAR(20) NOT NULL DEFAULT 'group',
    vk_target_id VARCHAR(255) NOT NULL DEFAULT '',
    vk_screen_name VARCHAR(255) NOT NULL DEFAULT '',
    access_token TEXT NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vk_accounts_user ON t_p28211681_photo_secure_web.vk_accounts(user_id);

INSERT INTO t_p28211681_photo_secure_web.vk_accounts
    (user_id, title, kind, vk_target_id, access_token, is_default)
SELECT user_id,
       'Сообщество ' || COALESCE(NULLIF(vk_group_id, ''), 'ВК'),
       'group',
       COALESCE(vk_group_id, ''),
       COALESCE(vk_group_token, ''),
       TRUE
FROM t_p28211681_photo_secure_web.vk_settings
WHERE COALESCE(vk_group_id, '') <> '' AND COALESCE(vk_group_token, '') <> '';

ALTER TABLE t_p28211681_photo_secure_web.clients
    ADD COLUMN IF NOT EXISTS vk_account_id INTEGER;