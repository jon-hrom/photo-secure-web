-- Добавляем настройки для фонового видео страницы входа
INSERT INTO t_p28211681_photo_secure_web.app_settings (setting_key, setting_value, description, updated_at)
VALUES 
  ('login_background_video_id', '', 'ID выбранного фонового видео для страницы входа', NOW()),
  ('login_background_video_url', '', 'URL фонового видео для десктопа', NOW()),
  ('login_mobile_background_url', '', 'URL фонового изображения/GIF для мобильных устройств', NOW()),
  ('login_background_image_id', '', 'ID выбранного фонового изображения (если видео не используется)', NOW()),
  ('login_background_opacity', '20', 'Прозрачность фона страницы входа (0-100)', NOW())
ON CONFLICT (setting_key) DO NOTHING;
