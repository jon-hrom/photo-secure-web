UPDATE retouch_tasks 
SET status = 'failed', 
    error_message = 'Задача зависла и была автоматически отменена', 
    updated_at = NOW() 
WHERE status IN ('queued', 'started') 
  AND created_at < NOW() - INTERVAL '10 minutes';