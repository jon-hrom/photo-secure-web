CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.settings_history (
    id SERIAL PRIMARY KEY,
    change_type VARCHAR(50) NOT NULL,
    change_data JSONB NOT NULL,
    changed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

CREATE INDEX idx_settings_history_created_at ON t_p28211681_photo_secure_web.settings_history(created_at DESC);
CREATE INDEX idx_settings_history_changed_by ON t_p28211681_photo_secure_web.settings_history(changed_by);
