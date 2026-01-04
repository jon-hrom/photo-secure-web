-- Сбрасываем флаг tech_analyzed для повторного анализа с детекцией улыбки
UPDATE t_p28211681_photo_secure_web.photo_bank
SET tech_analyzed = FALSE
WHERE tech_analyzed = TRUE;