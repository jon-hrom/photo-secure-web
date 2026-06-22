-- Статус одобрения регистрации фотографа
-- pending = на проверке, approved = одобрен, rejected = отклонён
ALTER TABLE t_p28211681_photo_secure_web.users
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';

-- Ссылки на портфолио (JSON массив строк)
ALTER TABLE t_p28211681_photo_secure_web.users
  ADD COLUMN IF NOT EXISTS portfolio_links TEXT NULL;

-- Видел ли пользователь приветственное окно при первом входе
ALTER TABLE t_p28211681_photo_secure_web.users
  ADD COLUMN IF NOT EXISTS welcome_seen BOOLEAN NOT NULL DEFAULT FALSE;

-- Существующие пользователи считаются одобренными и уже видевшими приветствие
UPDATE t_p28211681_photo_secure_web.users
  SET approval_status = 'approved', welcome_seen = TRUE
  WHERE approval_status IS NULL OR approval_status = 'approved';

-- Таблица заявок на регистрацию
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.registration_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  display_name VARCHAR(255) NULL,
  portfolio_links TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL,
  decided_by INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_reg_requests_status
  ON t_p28211681_photo_secure_web.registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_reg_requests_user
  ON t_p28211681_photo_secure_web.registration_requests(user_id);
