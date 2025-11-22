-- Таблица клиентов
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    vk_profile VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица бронирований
CREATE TABLE IF NOT EXISTS bookings (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    booking_date TIMESTAMP NOT NULL,
    booking_time VARCHAR(10) NOT NULL,
    description TEXT,
    notification_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);

-- Таблица проектов клиента
CREATE TABLE IF NOT EXISTS client_projects (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'new',
    budget DECIMAL(10, 2),
    start_date TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица платежей
CREATE TABLE IF NOT EXISTS client_payments (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    method VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица документов
CREATE TABLE IF NOT EXISTS client_documents (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    name VARCHAR(255) NOT NULL,
    file_url TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица комментариев
CREATE TABLE IF NOT EXISTS client_comments (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    author VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    comment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сообщений (история общения)
CREATE TABLE IF NOT EXISTS client_messages (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    type VARCHAR(50) NOT NULL,
    author VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    message_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для связанных таблиц
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON client_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON client_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_comments_client_id ON client_comments(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON client_messages(client_id);