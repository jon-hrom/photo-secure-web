
CREATE TABLE IF NOT EXISTS retouch_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    photo_id INTEGER,
    task_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    in_bucket VARCHAR(255) NOT NULL,
    in_key VARCHAR(500) NOT NULL,
    out_bucket VARCHAR(255),
    out_prefix VARCHAR(500),
    result_key VARCHAR(500),
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retouch_tasks_user_id ON retouch_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_retouch_tasks_task_id ON retouch_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_retouch_tasks_photo_id ON retouch_tasks(photo_id);
CREATE INDEX IF NOT EXISTS idx_retouch_tasks_status ON retouch_tasks(status);
