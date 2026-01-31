-- Закодировать URL фото с специальными символами (скобки, пробелы)
UPDATE t_p28211681_photo_secure_web.photo_bank
SET 
    s3_url = REPLACE(REPLACE(s3_url, '(', '%28'), ')', '%29'),
    thumbnail_s3_url = REPLACE(REPLACE(thumbnail_s3_url, '(', '%28'), ')', '%29')
WHERE s3_url LIKE '%(%' OR s3_url LIKE '%)%';