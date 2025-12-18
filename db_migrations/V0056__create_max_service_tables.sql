-- Таблица шаблонов сервисных сообщений MAX
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.max_service_templates (
    id SERIAL PRIMARY KEY,
    template_type VARCHAR(50) NOT NULL UNIQUE,
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица логов отправленных сервисных сообщений
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.max_service_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES t_p28211681_photo_secure_web.users(id)
);

-- Индексы для быстрой проверки лимитов
CREATE INDEX IF NOT EXISTS idx_max_logs_rate_limit 
ON t_p28211681_photo_secure_web.max_service_logs(user_id, client_phone, sent_at);

-- Базовые шаблоны сообщений
INSERT INTO t_p28211681_photo_secure_web.max_service_templates (template_type, template_text, variables) VALUES
('password_reset', '🔐 Восстановление пароля foto-mix.ru

Код для сброса пароля: {code}

Если вы не запрашивали восстановление - проигнорируйте это сообщение.

Код действителен 15 минут.', '["code"]'),

('new_booking', '📅 Новая бронь на фотосессию

Дата: {date}
Время: {time}
Описание: {description}

Подтвердите бронирование, пожалуйста!

С уважением, {photographer_name}', '["date", "time", "description", "photographer_name"]'),

('booking_reminder', '⏰ Напоминание о фотосессии

Завтра в {time} у вас запланирована фотосессия!

Адрес: {address}
Фотограф: {photographer_name}

До встречи! 📸', '["time", "address", "photographer_name"]'),

('project_ready', '✅ Ваши фотографии готовы!

Проект "{project_name}" готов к просмотру.

Перейдите по ссылке: {project_url}

С уважением, {photographer_name}', '["project_name", "project_url", "photographer_name"]'),

('payment_received', '💰 Оплата получена

Спасибо за оплату {amount} руб!

Заказ: {description}
Статус: Подтверждён

{photographer_name}', '["amount", "description", "photographer_name"]');

-- Комментарии
COMMENT ON TABLE t_p28211681_photo_secure_web.max_service_templates IS 'Шаблоны сервисных сообщений для отправки через MAX';
COMMENT ON TABLE t_p28211681_photo_secure_web.max_service_logs IS 'Логи отправленных сервисных сообщений (антиспам)';
