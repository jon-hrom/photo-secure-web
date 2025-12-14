-- Добавляем колонку role в таблицу users в правильной схеме
-- По умолчанию все пользователи имеют роль 'user'
ALTER TABLE t_p28211681_photo_secure_web.users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user' NOT NULL;

-- Создаём индекс для быстрого поиска по роли
CREATE INDEX IF NOT EXISTS idx_users_role ON t_p28211681_photo_secure_web.users(role);

-- Комментарий для документации
COMMENT ON COLUMN t_p28211681_photo_secure_web.users.role IS 'Роль пользователя: user (обычный) или admin (администратор)';