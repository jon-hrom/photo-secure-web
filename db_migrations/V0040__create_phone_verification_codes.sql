CREATE TABLE IF NOT EXISTS phone_verification_codes (
    phone VARCHAR(20) PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_expires ON phone_verification_codes(expires_at);
