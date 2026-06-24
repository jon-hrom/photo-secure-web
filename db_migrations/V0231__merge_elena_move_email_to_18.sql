-- Переносим email VK-аккаунта как доп. email основного (не основной)
UPDATE t_p28211681_photo_secure_web.user_emails
SET user_id = 18, is_primary = FALSE
WHERE user_id = 17
  AND NOT EXISTS (
    SELECT 1 FROM t_p28211681_photo_secure_web.user_emails ue2
    WHERE ue2.user_id = 18 AND ue2.email = user_emails.email
  );