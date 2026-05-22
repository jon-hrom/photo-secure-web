ALTER TABLE retouch_tasks ADD COLUMN IF NOT EXISTS preset VARCHAR(16) NOT NULL DEFAULT 'medium';
CREATE INDEX IF NOT EXISTS idx_retouch_tasks_preset ON retouch_tasks(preset);