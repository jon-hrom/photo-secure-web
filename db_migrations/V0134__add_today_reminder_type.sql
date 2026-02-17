ALTER TABLE t_p28211681_photo_secure_web.shooting_reminders_log 
DROP CONSTRAINT IF EXISTS shooting_reminders_log_reminder_type_check;

ALTER TABLE t_p28211681_photo_secure_web.shooting_reminders_log 
ADD CONSTRAINT shooting_reminders_log_reminder_type_check 
CHECK (reminder_type IN ('24h', '5h', '1h', 'today'));