CREATE TABLE IF NOT EXISTS retouch_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description VARCHAR(500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO retouch_settings (key, value, description) VALUES
    ('ldm_steps', '20', 'Количество шагов LaMa inpaint (1-50). Больше = качественнее, но медленнее')
ON CONFLICT (key) DO NOTHING;