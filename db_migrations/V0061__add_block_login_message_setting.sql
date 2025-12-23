-- Добавляем настройку для кастомного текста уведомления о блокировке входа
INSERT INTO t_p28211681_photo_secure_web.app_settings (setting_key, setting_value, description, updated_at)
VALUES (
    'block_login_message',
    'Доступ на вход временно недоступен по техническим причинам',
    'Текст уведомления при блокировке входа для пользователей',
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;