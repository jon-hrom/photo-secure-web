-- Тикеты техподдержки
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    user_identifier VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    request_type VARCHAR(20) NOT NULL DEFAULT 'question',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    subject VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_message_preview VARCHAR(500),
    user_unread_count INTEGER NOT NULL DEFAULT 0,
    admin_unread_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON t_p28211681_photo_secure_web.support_tickets(user_identifier);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON t_p28211681_photo_secure_web.support_tickets(status);

-- Сообщения внутри тикета
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.support_ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES t_p28211681_photo_secure_web.support_tickets(id),
    sender VARCHAR(20) NOT NULL DEFAULT 'user',
    sender_name VARCHAR(255),
    body TEXT,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON t_p28211681_photo_secure_web.support_ticket_messages(ticket_id);
