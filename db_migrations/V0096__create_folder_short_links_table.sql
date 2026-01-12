-- Создаем таблицу для коротких ссылок на папки с фото
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.folder_short_links (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(10) NOT NULL UNIQUE,
    folder_id INTEGER NOT NULL REFERENCES t_p28211681_photo_secure_web.photo_folders(id),
    user_id INTEGER NOT NULL REFERENCES t_p28211681_photo_secure_web.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_folder_short_links_code ON t_p28211681_photo_secure_web.folder_short_links(short_code);
CREATE INDEX IF NOT EXISTS idx_folder_short_links_folder ON t_p28211681_photo_secure_web.folder_short_links(folder_id);
