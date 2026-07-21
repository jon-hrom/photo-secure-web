-- Задачи-напоминания клиенту оставить отзыв (через 2 дня после входа в галерею).
-- Отправляются по Email и MAX, только если клиент не оставил отзыв.
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.review_reminders (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    gallery_code VARCHAR(16) NOT NULL,
    photographer_id INTEGER NOT NULL,
    portfolio_slug VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    send_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | sent | cancelled | skipped
    channels_sent VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    UNIQUE(client_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reminders_due
    ON t_p28211681_photo_secure_web.review_reminders (status, send_at);
CREATE INDEX IF NOT EXISTS idx_review_reminders_gallery
    ON t_p28211681_photo_secure_web.review_reminders (gallery_code);