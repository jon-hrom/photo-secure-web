
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links 
ADD COLUMN IF NOT EXISTS client_upload_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.client_upload_folders (
    id SERIAL PRIMARY KEY,
    parent_folder_id integer NOT NULL REFERENCES t_p28211681_photo_secure_web.photo_folders(id),
    short_link_id integer NOT NULL REFERENCES t_p28211681_photo_secure_web.folder_short_links(id),
    folder_name text NOT NULL,
    client_name text,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    s3_prefix text,
    photo_count integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.client_upload_photos (
    id SERIAL PRIMARY KEY,
    upload_folder_id integer NOT NULL REFERENCES t_p28211681_photo_secure_web.client_upload_folders(id),
    file_name text NOT NULL,
    s3_key text NOT NULL,
    s3_url text,
    thumbnail_s3_url text,
    content_type text,
    file_size bigint DEFAULT 0,
    width integer,
    height integer,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);
