-- Add max_clients field to storage_plans table
ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS max_clients INTEGER DEFAULT NULL;

-- Add description field for better UX
ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Update existing plans with reasonable defaults
UPDATE t_p28211681_photo_secure_web.storage_plans SET max_clients = 10, description = 'Для начинающих' WHERE name = 'Старт';
UPDATE t_p28211681_photo_secure_web.storage_plans SET max_clients = 50, description = 'Для небольших студий' WHERE name = 'Базовый';
UPDATE t_p28211681_photo_secure_web.storage_plans SET max_clients = 200, description = 'Для профессионалов' WHERE name = 'Профи';
UPDATE t_p28211681_photo_secure_web.storage_plans SET max_clients = 1000, description = 'Для крупных студий' WHERE name = 'Бизнес';