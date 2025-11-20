-- Add vk_id column to users table for VK authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_vk_id ON users(vk_id);