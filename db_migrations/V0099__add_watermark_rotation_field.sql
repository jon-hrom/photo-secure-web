-- Добавление поля watermark_rotation в таблицу folder_short_links
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links 
ADD COLUMN IF NOT EXISTS watermark_rotation INTEGER DEFAULT 0;

COMMENT ON COLUMN t_p28211681_photo_secure_web.folder_short_links.watermark_rotation IS 'Угол наклона водяного знака от -45 до +45 градусов';