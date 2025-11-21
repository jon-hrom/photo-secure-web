-- Ensure main admin has full unrestricted access
UPDATE users 
SET 
  is_active = TRUE,
  is_blocked = FALSE,
  two_factor_sms = FALSE,
  two_factor_email = FALSE,
  email_verified_at = CURRENT_TIMESTAMP
WHERE email = 'jonhrom2012@gmail.com';

-- Also ensure VK admin user has full access (your VK ID)
UPDATE users u
SET 
  is_active = TRUE,
  is_blocked = FALSE
FROM vk_users v
WHERE u.id = v.user_id 
  AND v.vk_sub = '74713477'
  AND v.full_name LIKE '%Евгений%Пономар%';
