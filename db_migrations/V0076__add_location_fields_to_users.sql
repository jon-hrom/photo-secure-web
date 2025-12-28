ALTER TABLE users 
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS region VARCHAR(100),
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

COMMENT ON COLUMN users.country IS 'Страна фотографа';
COMMENT ON COLUMN users.region IS 'Область / регион фотографа';
COMMENT ON COLUMN users.city IS 'Город фотографа';
