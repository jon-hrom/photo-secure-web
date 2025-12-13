-- Добавляем поля для верификации телефона
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS phone_verification_attempts INTEGER DEFAULT 0;

-- Для существующих пользователей с номером телефона считаем что номер подтверждён
UPDATE users 
SET phone_verified_at = NOW() 
WHERE phone IS NOT NULL AND phone != '' AND phone_verified_at IS NULL;
