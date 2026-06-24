-- Переносим email Яндекса как доп. email главного аккаунта 12 (не основной)
UPDATE t_p28211681_photo_secure_web.user_emails
SET user_id = 12, is_primary = FALSE
WHERE user_id = 30
  AND NOT EXISTS (
    SELECT 1 FROM t_p28211681_photo_secure_web.user_emails ue2
    WHERE ue2.user_id = 12 AND ue2.email = user_emails.email
  );