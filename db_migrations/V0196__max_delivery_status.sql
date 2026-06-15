ALTER TABLE t_p28211681_photo_secure_web.max_service_logs
    ADD COLUMN IF NOT EXISTS message_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMP WITHOUT TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_max_logs_message_id ON t_p28211681_photo_secure_web.max_service_logs (message_id);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.max_delivery_events (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100) NULL,
    chat_id VARCHAR(50) NULL,
    phone VARCHAR(20) NULL,
    status VARCHAR(30) NOT NULL,
    type_webhook VARCHAR(50) NULL,
    raw JSONB NULL,
    received_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_max_delivery_msg ON t_p28211681_photo_secure_web.max_delivery_events (message_id);
CREATE INDEX IF NOT EXISTS idx_max_delivery_phone ON t_p28211681_photo_secure_web.max_delivery_events (phone);