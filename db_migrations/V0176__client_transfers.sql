-- Передача клиентов/проектов между фотографами

CREATE TABLE IF NOT EXISTS client_transfers (
    id BIGSERIAL PRIMARY KEY,
    sender_user_id VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_phone VARCHAR(50),
    sender_email VARCHAR(255),
    recipient_user_id VARCHAR(255),
    recipient_lookup_type VARCHAR(20) NOT NULL,
    recipient_lookup_value VARCHAR(255) NOT NULL,
    scope VARCHAR(20) NOT NULL,
    client_id BIGINT NOT NULL,
    project_id BIGINT,
    client_name_snapshot VARCHAR(255),
    project_name_snapshot VARCHAR(255),
    comment TEXT,
    reply_comment TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    invite_sent_via VARCHAR(20),
    invite_sent_at TIMESTAMP,
    seen_by_recipient_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_transfers_sender ON client_transfers(sender_user_id, status);
CREATE INDEX IF NOT EXISTS idx_client_transfers_recipient ON client_transfers(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_client_transfers_lookup ON client_transfers(recipient_lookup_value, status);
CREATE INDEX IF NOT EXISTS idx_client_transfers_status ON client_transfers(status, expires_at);

CREATE TABLE IF NOT EXISTS client_transfer_history (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    transfer_id BIGINT NOT NULL,
    counterparty_name VARCHAR(255),
    counterparty_user_id VARCHAR(255),
    client_name VARCHAR(255),
    project_name VARCHAR(255),
    scope VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    note TEXT,
    happened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_history_user ON client_transfer_history(user_id, happened_at DESC);
