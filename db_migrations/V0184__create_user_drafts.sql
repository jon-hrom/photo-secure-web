CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.user_drafts (
    id SERIAL PRIMARY KEY,
    photographer_id INTEGER NOT NULL,
    draft_type VARCHAR(32) NOT NULL,
    client_id INTEGER,
    payload JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (photographer_id, draft_type, client_id)
);

CREATE INDEX IF NOT EXISTS idx_user_drafts_photographer ON t_p28211681_photo_secure_web.user_drafts (photographer_id);
CREATE INDEX IF NOT EXISTS idx_user_drafts_type ON t_p28211681_photo_secure_web.user_drafts (photographer_id, draft_type);
