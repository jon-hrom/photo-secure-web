UPDATE photo_bank SET is_trashed = TRUE, trashed_at = NOW() WHERE id = 3047;

UPDATE retouch_tasks 
SET status = 'failed', 
    result_key = NULL, 
    result_url = NULL, 
    error_message = 'Результат повреждён (формат ответа изменился). Нажмите Повторить.',
    updated_at = NOW()
WHERE task_id = 'e4f5fd62-a51a-4aa1-b28f-5dfbdfbbca44';