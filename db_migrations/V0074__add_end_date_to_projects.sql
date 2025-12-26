-- Добавляем поле end_date для хранения даты завершения проекта
ALTER TABLE t_p28211681_photo_secure_web.client_projects 
ADD COLUMN end_date TIMESTAMP;