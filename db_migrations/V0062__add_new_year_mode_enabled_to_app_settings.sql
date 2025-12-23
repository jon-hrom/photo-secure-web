-- Add new_year_mode_enabled field to app_settings
ALTER TABLE t_p28211681_photo_secure_web.app_settings 
ADD COLUMN IF NOT EXISTS new_year_mode_enabled BOOLEAN DEFAULT FALSE;