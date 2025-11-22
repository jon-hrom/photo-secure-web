-- Изменяем структуру таблицы client_documents
-- Заменяем file_url (полный URL) на s3_key (только ключ в S3)
ALTER TABLE client_documents RENAME COLUMN file_url TO s3_key;

-- Обновляем существующие записи: извлекаем S3 key из URL
-- Формат старого URL: https://storage.yandexcloud.net/foto-mix/client-documents/UUID.ext
-- Нужно извлечь: client-documents/UUID.ext
UPDATE client_documents 
SET s3_key = SUBSTRING(s3_key FROM 'client-documents/.*')
WHERE s3_key LIKE '%storage.yandexcloud.net%';
