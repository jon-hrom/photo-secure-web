CREATE INDEX IF NOT EXISTS idx_photo_bank_folder_active
ON t_p28211681_photo_secure_web.photo_bank (folder_id)
WHERE is_trashed = FALSE;