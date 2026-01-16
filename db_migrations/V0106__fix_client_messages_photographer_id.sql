-- Обновляем старые сообщения: добавляем photographer_id и sender_type
UPDATE t_p28211681_photo_secure_web.client_messages cm
SET 
  photographer_id = (
    SELECT user_id 
    FROM t_p28211681_photo_secure_web.photo_folders pf
    WHERE pf.client_id = cm.client_id
    LIMIT 1
  ),
  sender_type = 'photographer'
WHERE photographer_id IS NULL AND sender_type IS NULL;
