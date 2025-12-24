-- Обновляем настройки фонового видео на реальное загруженное видео
UPDATE t_p28211681_photo_secure_web.app_settings 
SET setting_value = '34111e78-35a7-4fd7-8c6c-ed3a7ba4cf9b', updated_at = NOW() 
WHERE setting_key = 'login_background_video_id';

UPDATE t_p28211681_photo_secure_web.app_settings 
SET setting_value = 'https://cdn.poehali.dev/projects/07a45ae1-582a-4829-83a6-3f379eb489ff/bucket/background-media/34111e78-35a7-4fd7-8c6c-ed3a7ba4cf9b.webm', updated_at = NOW() 
WHERE setting_key = 'login_background_video_url';
