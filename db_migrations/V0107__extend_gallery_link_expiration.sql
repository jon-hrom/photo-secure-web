-- Продление срока действия истекшей ссылки WHcLYxR1 на 365 дней
UPDATE t_p28211681_photo_secure_web.folder_short_links
SET expires_at = NOW() + INTERVAL '365 days'
WHERE short_code = 'WHcLYxR1';
