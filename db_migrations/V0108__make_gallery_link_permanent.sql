-- Делаем ссылку WHcLYxR1 бессрочной (expires_at = NULL)
UPDATE t_p28211681_photo_secure_web.folder_short_links
SET expires_at = NULL
WHERE short_code = 'WHcLYxR1';
