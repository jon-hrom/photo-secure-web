-- Create temporary sessions table for VK auth
CREATE TABLE IF NOT EXISTS vk_temp_sessions (
  session_id VARCHAR(32) PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_vk_temp_sessions_expires ON vk_temp_sessions(expires_at);