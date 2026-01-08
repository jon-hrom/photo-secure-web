-- Add birthdate and VK username fields to clients table
ALTER TABLE t_p28211681_photo_secure_web.clients 
ADD COLUMN birthdate DATE,
ADD COLUMN vk_username VARCHAR(255);