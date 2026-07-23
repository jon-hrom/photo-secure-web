UPDATE t_p28211681_photo_secure_web.user_emails ue
SET is_verified = TRUE,
    verified_at = COALESCE(ue.verified_at, u.email_verified_at, NOW())
FROM t_p28211681_photo_secure_web.users u
WHERE ue.user_id = u.id
  AND ue.is_primary = TRUE
  AND ue.is_verified = FALSE
  AND u.email_verified_at IS NOT NULL
  AND lower(ue.email) = lower(u.email);