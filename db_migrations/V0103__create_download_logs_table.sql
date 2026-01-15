-- Create download logs table for detailed statistics
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.download_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p28211681_photo_secure_web.users(id),
    folder_id INTEGER REFERENCES t_p28211681_photo_secure_web.photo_folders(id),
    photo_id INTEGER REFERENCES t_p28211681_photo_secure_web.photo_bank(id),
    download_type VARCHAR(20) NOT NULL CHECK (download_type IN ('archive', 'photo')),
    client_ip VARCHAR(45),
    user_agent TEXT,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_download_logs_user_id ON t_p28211681_photo_secure_web.download_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_folder_id ON t_p28211681_photo_secure_web.download_logs(folder_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_photo_id ON t_p28211681_photo_secure_web.download_logs(photo_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_at ON t_p28211681_photo_secure_web.download_logs(downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_logs_type ON t_p28211681_photo_secure_web.download_logs(download_type);

COMMENT ON TABLE t_p28211681_photo_secure_web.download_logs IS 'Detailed logs of all downloads for statistics';
COMMENT ON COLUMN t_p28211681_photo_secure_web.download_logs.download_type IS 'Type of download: archive (folder zip) or photo (single file)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.download_logs.client_ip IS 'IP address of the client who downloaded';
COMMENT ON COLUMN t_p28211681_photo_secure_web.download_logs.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN t_p28211681_photo_secure_web.download_logs.downloaded_at IS 'Timestamp when the download occurred';