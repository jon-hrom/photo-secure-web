-- Create table for birthday notification settings per photographer
CREATE TABLE t_p28211681_photo_secure_web.birthday_notification_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    notification_days_before INTEGER NOT NULL DEFAULT 10,
    greeting_message TEXT NOT NULL DEFAULT 'Дорогой {name}, поздравляю тебя с Днём Рождения! Желаю здоровья, счастья и ярких моментов! С уважением, твой фотограф.',
    send_to_max BOOLEAN NOT NULL DEFAULT true,
    send_to_email BOOLEAN NOT NULL DEFAULT true,
    send_to_vk BOOLEAN NOT NULL DEFAULT true,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create table to track sent birthday notifications
CREATE TABLE t_p28211681_photo_secure_web.birthday_notifications_log (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES t_p28211681_photo_secure_web.clients(id),
    notification_type VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    year INTEGER NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT
);