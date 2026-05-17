CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.gallery_view_logs (
  id BIGSERIAL PRIMARY KEY,
  short_link_id INTEGER NOT NULL REFERENCES t_p28211681_photo_secure_web.folder_short_links(id),
  folder_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  short_code VARCHAR(10) NOT NULL,
  client_ip VARCHAR(64),
  user_agent TEXT,
  device_type VARCHAR(20),
  viewed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gv_folder_user ON t_p28211681_photo_secure_web.gallery_view_logs(user_id, folder_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gv_short_link ON t_p28211681_photo_secure_web.gallery_view_logs(short_link_id, viewed_at DESC);