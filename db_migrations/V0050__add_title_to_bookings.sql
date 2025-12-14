-- Добавляем поле title в таблицу bookings
ALTER TABLE t_p28211681_photo_secure_web.bookings 
ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT '';

-- Обновляем существующие записи: берем название из связанного проекта
UPDATE t_p28211681_photo_secure_web.bookings b
SET title = (
    SELECT p.name 
    FROM t_p28211681_photo_secure_web.client_projects p 
    WHERE p.client_id = b.client_id 
    LIMIT 1
)
WHERE title = '' OR title IS NULL;