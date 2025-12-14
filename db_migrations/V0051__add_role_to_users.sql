-- Добавляем колонку role в таблицу users
-- По умолчанию все пользователи имеют роль 'user'
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user' NOT NULL;

-- Создаём индекс для быстрого поиска по роли
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Комментарий для документации
COMMENT ON COLUMN users.role IS 'Роль пользователя: user (обычный) или admin (администратор)';