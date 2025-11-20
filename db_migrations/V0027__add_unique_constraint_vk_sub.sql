-- Add unique constraint on vk_sub to prevent duplicate VK users
ALTER TABLE t_p28211681_photo_secure_web.vk_users 
ADD CONSTRAINT vk_users_vk_sub_unique UNIQUE (vk_sub);