-- Create table for password reset codes
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.password_reset_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    code VARCHAR(6) NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    method_type VARCHAR(10) NOT NULL DEFAULT 'email',
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_session ON t_p28211681_photo_secure_web.password_reset_codes(session_token);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON t_p28211681_photo_secure_web.password_reset_codes(expires_at);

COMMENT ON TABLE t_p28211681_photo_secure_web.password_reset_codes IS 'Коды для восстановления пароля через email или SMS';
COMMENT ON COLUMN t_p28211681_photo_secure_web.password_reset_codes.user_id IS 'ID пользователя';
COMMENT ON COLUMN t_p28211681_photo_secure_web.password_reset_codes.code IS 'Код подтверждения (6 цифр)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.password_reset_codes.session_token IS 'Уникальный токен сессии восстановления';
COMMENT ON COLUMN t_p28211681_photo_secure_web.password_reset_codes.expires_at IS 'Время истечения кода (обычно 10 минут)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.password_reset_codes.method_type IS 'Способ отправки: email или sms';
COMMENT ON COLUMN t_p28211681_photo_secure_web.password_reset_codes.used IS 'Флаг использования кода';
