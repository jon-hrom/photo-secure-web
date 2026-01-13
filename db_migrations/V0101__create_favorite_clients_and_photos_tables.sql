-- Таблица для хранения клиентов избранного
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.favorite_clients (
    id SERIAL PRIMARY KEY,
    gallery_code VARCHAR(8) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(gallery_code, full_name, phone)
);

-- Индекс для быстрого поиска по ФИО (регистронезависимый)
CREATE INDEX idx_favorite_clients_fullname_lower ON t_p28211681_photo_secure_web.favorite_clients (gallery_code, LOWER(full_name));

-- Таблица для хранения избранных фото клиентов
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.favorite_photos (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    photo_id INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(client_id, photo_id)
);

-- Индекс для быстрого получения всех фото клиента
CREATE INDEX idx_favorite_photos_client ON t_p28211681_photo_secure_web.favorite_photos (client_id);