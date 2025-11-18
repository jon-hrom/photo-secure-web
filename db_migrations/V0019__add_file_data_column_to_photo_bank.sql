-- Add file_data column to store images directly in database
-- This replaces slow REG.Cloud S3 storage with fast PostgreSQL bytea storage

ALTER TABLE photo_bank ADD COLUMN IF NOT EXISTS file_data bytea;

COMMENT ON COLUMN photo_bank.file_data IS 'Image file data stored as bytea (replaces S3 storage)';