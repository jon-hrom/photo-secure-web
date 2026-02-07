CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    jwt_token TEXT NOT NULL,
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON t_p28211681_photo_secure_web.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON t_p28211681_photo_secure_web.user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON t_p28211681_photo_secure_web.user_sessions(device_id);