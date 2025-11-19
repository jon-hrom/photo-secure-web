-- Create table for 2FA disable requests
CREATE TABLE IF NOT EXISTS two_factor_disable_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  requested_by_admin_id BIGINT NOT NULL,
  disable_type VARCHAR(10) NOT NULL CHECK (disable_type IN ('sms', 'email', 'both')),
  verification_code VARCHAR(6) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_2fa_disable_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_2fa_disable_admin FOREIGN KEY (requested_by_admin_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_2fa_disable_user ON two_factor_disable_requests(user_id, is_verified, is_cancelled);
CREATE INDEX IF NOT EXISTS idx_2fa_disable_created ON two_factor_disable_requests(created_at DESC);

COMMENT ON TABLE two_factor_disable_requests IS 'Requests to disable 2FA from admin, requires user email verification';
COMMENT ON COLUMN two_factor_disable_requests.disable_type IS 'Type of 2FA to disable: sms, email, or both';
COMMENT ON COLUMN two_factor_disable_requests.verification_code IS '6-digit code sent to user email (no expiration)';
COMMENT ON COLUMN two_factor_disable_requests.is_verified IS 'True when user verified code and 2FA was disabled';
COMMENT ON COLUMN two_factor_disable_requests.is_cancelled IS 'True if admin cancelled the request before user verified';