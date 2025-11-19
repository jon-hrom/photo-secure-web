-- Add email verification fields to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_verification_hash VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS email_verification_sends INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verification_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verification_locked_until TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS email_verification_last_sent_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS email_verification_window_start_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified_at);

-- Create email verification logs table
CREATE TABLE IF NOT EXISTS email_verification_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event VARCHAR(32) NOT NULL,
  ip INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_created ON email_verification_logs(user_id, created_at DESC);

COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified (NULL = not verified)';
COMMENT ON COLUMN users.phone IS 'User phone number in E.164 format (required, not verified yet)';
COMMENT ON COLUMN users.email_verification_hash IS 'SHA-256 hash of verification code + email + salt';
COMMENT ON COLUMN users.email_verification_expires_at IS 'When verification code expires (TTL 10 min)';
COMMENT ON COLUMN users.email_verification_sends IS 'Number of codes sent in current hour window';
COMMENT ON COLUMN users.email_verification_attempts IS 'Number of verification attempts in current hour';
COMMENT ON COLUMN users.email_verification_locked_until IS 'Lock verification attempts until this time (after 5 fails)';
COMMENT ON TABLE email_verification_logs IS 'Audit log for email verification events (sent/verified/failed/expired/locked)';