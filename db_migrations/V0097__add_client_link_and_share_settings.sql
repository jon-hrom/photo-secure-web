-- Добавляем связь папок с клиентами
ALTER TABLE t_p28211681_photo_secure_web.photo_folders 
ADD COLUMN IF NOT EXISTS client_id bigint;

-- Добавляем настройки для короткой ссылки
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS download_disabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_folder_short_links_short_code ON t_p28211681_photo_secure_web.folder_short_links(short_code);
CREATE INDEX IF NOT EXISTS idx_photo_folders_client_id ON t_p28211681_photo_secure_web.photo_folders(client_id);
