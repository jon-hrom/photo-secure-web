-- Migration: Create user_files table for tracking uploads
-- This table stores metadata about files uploaded to Yandex Object Storage

CREATE TABLE IF NOT EXISTS user_files (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  size_bytes BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  original_filename TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_files_owner ON user_files (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_status ON user_files (status);
CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON user_files (created_at DESC);

COMMENT ON TABLE user_files IS 'Stores metadata about user uploaded files in Object Storage';
COMMENT ON COLUMN user_files.owner_user_id IS 'ID of the user who owns this file';
COMMENT ON COLUMN user_files.s3_key IS 'Full S3 key: incoming/{userId}/{uuid}.{ext}';
COMMENT ON COLUMN user_files.size_bytes IS 'File size in bytes';
COMMENT ON COLUMN user_files.content_type IS 'MIME type of the file';
COMMENT ON COLUMN user_files.status IS 'Status: uploaded, processing, processed, failed, removed';
COMMENT ON COLUMN user_files.checksum IS 'ETag or MD5 checksum from S3';