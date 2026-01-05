-- Удаляем пустую папку tech_rejects которая осталась после ручного восстановления фото
UPDATE t_p28211681_photo_secure_web.photo_folders
SET is_trashed = TRUE, trashed_at = NOW()
WHERE id = 81 
  AND user_id = 12 
  AND folder_type = 'tech_rejects'
  AND (SELECT COUNT(*) FROM t_p28211681_photo_secure_web.photo_bank WHERE folder_id = 81 AND is_trashed = FALSE) = 0;
