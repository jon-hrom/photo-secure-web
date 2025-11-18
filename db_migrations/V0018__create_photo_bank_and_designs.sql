-- Таблица для фото-банка (папки с фотографиями пользователя)
CREATE TABLE IF NOT EXISTS photo_folders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    folder_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для фотографий в фото-банке
CREATE TABLE IF NOT EXISTS photo_bank (
    id SERIAL PRIMARY KEY,
    folder_id INTEGER NOT NULL REFERENCES photo_folders(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для сохраненных дизайнов фотокниг
CREATE TABLE IF NOT EXISTS photobook_designs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    config JSONB NOT NULL,
    method TEXT NOT NULL,
    fill_method TEXT,
    template JSONB,
    spreads JSONB NOT NULL,
    enable_client_link BOOLEAN DEFAULT false,
    client_link_id TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для связи фотографий с дизайнами
CREATE TABLE IF NOT EXISTS photobook_design_photos (
    id SERIAL PRIMARY KEY,
    design_id INTEGER NOT NULL REFERENCES photobook_designs(id),
    photo_bank_id INTEGER REFERENCES photo_bank(id),
    photo_url TEXT NOT NULL,
    photo_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_photo_folders_user_id ON photo_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_bank_folder_id ON photo_bank(folder_id);
CREATE INDEX IF NOT EXISTS idx_photo_bank_user_id ON photo_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_photobook_designs_user_id ON photobook_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_photobook_design_photos_design_id ON photobook_design_photos(design_id);
