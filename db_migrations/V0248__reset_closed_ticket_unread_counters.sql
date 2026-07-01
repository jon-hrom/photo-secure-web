-- Сброс "зависших" счётчиков непрочитанных у закрытых обращений техподдержки.
-- Из-за них на конверте показывались непрочитанные сообщения, которых уже нет.
UPDATE t_p28211681_photo_secure_web.support_tickets
SET user_unread_count = 0,
    admin_unread_count = 0
WHERE status = 'closed'
  AND (user_unread_count > 0 OR admin_unread_count > 0);