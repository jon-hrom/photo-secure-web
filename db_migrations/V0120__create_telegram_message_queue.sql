-- Таблица для буфера неотправленных Telegram-сообщений клиентам
CREATE TABLE IF NOT EXISTS telegram_message_queue (
    id SERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    photographer_id INTEGER NOT NULL REFERENCES users(id),
    booking_id BIGINT NULL REFERENCES bookings(id),
    message_type VARCHAR(50) NOT NULL DEFAULT 'booking_created',
    message_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_error TEXT NULL
);

CREATE INDEX idx_telegram_queue_client ON telegram_message_queue(client_id);
CREATE INDEX idx_telegram_queue_status ON telegram_message_queue(status);
CREATE INDEX idx_telegram_queue_expires ON telegram_message_queue(expires_at);
CREATE INDEX idx_telegram_queue_booking ON telegram_message_queue(booking_id);

COMMENT ON TABLE telegram_message_queue IS 'Буфер сообщений для клиентов, которые еще не подключили Telegram';
COMMENT ON COLUMN telegram_message_queue.status IS 'pending - ожидает, sent - отправлено, expired - истекло';
COMMENT ON COLUMN telegram_message_queue.message_type IS 'booking_created, booking_reminder, payment_reminder и т.д.';