-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    two_factor_sms BOOLEAN DEFAULT false,
    two_factor_email BOOLEAN DEFAULT false,
    vk_id VARCHAR(100),
    source VARCHAR(50) DEFAULT 'email',
    email_verified_at TIMESTAMP,
    visible BOOLEAN DEFAULT true,
    last_storage_warning_sent TIMESTAMP,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    appointment_duration INTEGER DEFAULT 60,
    appointment_buffer INTEGER DEFAULT 15,
    appointment_settings JSONB DEFAULT '{}'::jsonb
);

-- VK пользователи
CREATE TABLE IF NOT EXISTS vk_users (
    user_id SERIAL PRIMARY KEY,
    vk_sub VARCHAR(100) UNIQUE,
    email VARCHAR(255),
    phone_number VARCHAR(50),
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    raw_profile TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT false,
    blocked_at TIMESTAMP,
    blocked_by VARCHAR(255),
    block_reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true
);

-- OAuth сессии
CREATE TABLE IF NOT EXISTS oauth_sessions (
  state TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Временные VK сессии
CREATE TABLE IF NOT EXISTS vk_temp_sessions (
  session_id VARCHAR(32) PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица кодов двухфакторной аутентификации
CREATE TABLE IF NOT EXISTS two_factor_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    code VARCHAR(10) NOT NULL,
    code_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_vk_temp_sessions_expires ON vk_temp_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user ON two_factor_codes(user_id, expires_at);