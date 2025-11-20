-- Add source column to users table to track registration method
ALTER TABLE t_p28211681_photo_secure_web.users 
ADD COLUMN source VARCHAR(20) DEFAULT 'email';