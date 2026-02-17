
ALTER TABLE t_p28211681_photo_secure_web.client_upload_folders
ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES t_p28211681_photo_secure_web.favorite_clients(id);

CREATE INDEX IF NOT EXISTS idx_client_upload_folders_client_id 
ON t_p28211681_photo_secure_web.client_upload_folders(client_id);
