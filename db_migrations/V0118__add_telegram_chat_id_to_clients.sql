-- Add telegram_chat_id and telegram_verified fields to clients table
ALTER TABLE t_p28211681_photo_secure_web.clients 
ADD COLUMN telegram_chat_id VARCHAR(50),
ADD COLUMN telegram_verified BOOLEAN DEFAULT false,
ADD COLUMN telegram_verified_at TIMESTAMP;

-- Add comment
COMMENT ON COLUMN t_p28211681_photo_secure_web.clients.telegram_chat_id IS 'Telegram chat ID for notifications';
