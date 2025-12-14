-- Добавляем поля для GREEN-API credentials в таблицу users
-- Каждый фотограф теперь может подключить свой личный MAX аккаунт

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS green_api_instance_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS green_api_token VARCHAR(200),
ADD COLUMN IF NOT EXISTS max_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS max_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_connected_at TIMESTAMP;

-- Создаём индекс для быстрого поиска подключённых пользователей
CREATE INDEX IF NOT EXISTS idx_users_max_connected ON users(max_connected) WHERE max_connected = TRUE;

COMMENT ON COLUMN users.green_api_instance_id IS 'Instance ID из GREEN-API для личного MAX аккаунта фотографа';
COMMENT ON COLUMN users.green_api_token IS 'API Token из GREEN-API для доступа к MAX сообщениям';
COMMENT ON COLUMN users.max_phone IS 'Номер телефона в MAX мессенджере';
COMMENT ON COLUMN users.max_connected IS 'Флаг подключения MAX мессенджера';
COMMENT ON COLUMN users.max_connected_at IS 'Дата и время подключения MAX';