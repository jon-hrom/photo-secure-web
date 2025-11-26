-- Добавление колонки is_archived в таблицу blocked_user_appeals
ALTER TABLE blocked_user_appeals 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Индекс для фильтрации архивных обращений
CREATE INDEX IF NOT EXISTS idx_appeals_archived ON blocked_user_appeals(is_archived, created_at DESC);