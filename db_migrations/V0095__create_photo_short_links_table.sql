-- Создание таблицы для коротких ссылок на фото
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.photo_short_links (
  id SERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  photo_path TEXT NOT NULL,
  photo_name VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT NULL,
  access_count INTEGER DEFAULT 0
);

-- Индекс для быстрого поиска по короткому коду
CREATE INDEX idx_photo_short_links_code ON t_p28211681_photo_secure_web.photo_short_links(short_code);

-- Индекс для очистки истёкших ссылок
CREATE INDEX idx_photo_short_links_expires ON t_p28211681_photo_secure_web.photo_short_links(expires_at);