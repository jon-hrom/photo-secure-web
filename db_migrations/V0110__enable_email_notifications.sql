-- Включаем email уведомления
UPDATE t_p28211681_photo_secure_web.site_settings 
SET setting_value = 'true', 
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system'
WHERE setting_key = 'email_notifications_enabled';