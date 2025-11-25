UPDATE t_p28211681_photo_secure_web.users u
SET 
    is_blocked = v.is_blocked,
    blocked_reason = v.blocked_reason,
    blocked_at = v.blocked_at
FROM t_p28211681_photo_secure_web.vk_users v
WHERE u.id = v.user_id 
  AND u.is_blocked IS DISTINCT FROM v.is_blocked;