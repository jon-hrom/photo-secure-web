
CREATE TABLE IF NOT EXISTS retouch_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    pipeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO retouch_presets (name, pipeline_json, is_default) VALUES (
    'default',
    '[{"op":"deshine","strength":0.55,"knee":0.80},{"op":"skin_smooth","strength":0.40,"sigma_s":80,"sigma_r":0.18}]'::jsonb,
    TRUE
) ON CONFLICT (name) DO NOTHING;
