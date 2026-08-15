CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.gallery_event_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    short_code TEXT NOT NULL,
    event_type TEXT NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    folder_name TEXT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gallery_event_notif_user
    ON t_p28211681_photo_secure_web.gallery_event_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_event_notif_throttle
    ON t_p28211681_photo_secure_web.gallery_event_notifications (short_code, client_id, event_type, created_at DESC);