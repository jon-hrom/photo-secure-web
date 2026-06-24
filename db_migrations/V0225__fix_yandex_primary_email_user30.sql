UPDATE t_p28211681_photo_secure_web.user_emails
SET is_primary = TRUE
WHERE id = 136 AND user_id = 30
  AND NOT EXISTS (
    SELECT 1 FROM t_p28211681_photo_secure_web.user_emails e2
    WHERE e2.user_id = 30 AND e2.is_primary = TRUE
  );