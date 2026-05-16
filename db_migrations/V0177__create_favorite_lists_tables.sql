CREATE TABLE IF NOT EXISTS favorite_lists (
    id SERIAL PRIMARY KEY,
    gallery_code VARCHAR(8) NOT NULL,
    parent_folder_id INTEGER NOT NULL REFERENCES photo_folders(id),
    short_link_id INTEGER REFERENCES folder_short_links(id),
    client_id INTEGER REFERENCES favorite_clients(id),
    name VARCHAR(255) NOT NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_favorite_lists_gallery_code ON favorite_lists(gallery_code);
CREATE INDEX IF NOT EXISTS idx_favorite_lists_parent_folder ON favorite_lists(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_favorite_lists_client ON favorite_lists(client_id);

CREATE TABLE IF NOT EXISTS favorite_list_photos (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES favorite_lists(id),
    photo_id INTEGER NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(list_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_list_photos_list ON favorite_list_photos(list_id);
CREATE INDEX IF NOT EXISTS idx_favorite_list_photos_photo ON favorite_list_photos(photo_id);
