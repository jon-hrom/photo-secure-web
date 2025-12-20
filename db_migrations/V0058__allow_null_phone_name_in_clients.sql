-- Разрешаем NULL для полей phone и name в таблице clients
ALTER TABLE t_p28211681_photo_secure_web.clients
  ALTER COLUMN phone SET DEFAULT '',
  ALTER COLUMN name SET DEFAULT 'Новый клиент';

-- Убираем NOT NULL ограничение (устанавливаем NULL)
ALTER TABLE t_p28211681_photo_secure_web.clients
  ALTER COLUMN phone TYPE VARCHAR(50),
  ALTER COLUMN name TYPE VARCHAR(255);