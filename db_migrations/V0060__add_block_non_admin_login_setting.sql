-- Добавляем настройку блокировки входа для всех пользователей кроме администраторов
INSERT INTO t_p28211681_photo_secure_web.app_settings (setting_key, setting_value, description, updated_at)
VALUES (
    'block_non_admin_login',
    'false',
    'Блокировать вход на сайт для всех пользователей кроме администраторов',
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;