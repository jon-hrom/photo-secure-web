-- Добавляем настройки водяных знаков в таблицу коротких ссылок
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
ADD COLUMN watermark_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN watermark_type VARCHAR(10) DEFAULT 'text',
ADD COLUMN watermark_text TEXT,
ADD COLUMN watermark_image_url TEXT,
ADD COLUMN watermark_frequency INTEGER DEFAULT 50,
ADD COLUMN watermark_size INTEGER DEFAULT 20,
ADD COLUMN watermark_opacity INTEGER DEFAULT 50,
ADD COLUMN screenshot_protection BOOLEAN DEFAULT FALSE;