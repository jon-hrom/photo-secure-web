-- Create app_settings table to store global application settings
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
    ('registration_enabled', 'true', 'Allow new user registrations'),
    ('maintenance_mode', 'false', 'Site maintenance mode'),
    ('guest_access', 'false', 'Allow guest access without authentication')
ON CONFLICT (setting_key) DO NOTHING;