-- Таблица для хранения invite-ссылок на подключение клиентов к Telegram
CREATE TABLE IF NOT EXISTS telegram_invites (
    id SERIAL PRIMARY KEY,
    invite_code VARCHAR(32) UNIQUE NOT NULL,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    photographer_id INTEGER NOT NULL REFERENCES users(id),
    client_phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_telegram_invites_code ON telegram_invites(invite_code);
CREATE INDEX idx_telegram_invites_client ON telegram_invites(client_id);
CREATE INDEX idx_telegram_invites_expires ON telegram_invites(expires_at);