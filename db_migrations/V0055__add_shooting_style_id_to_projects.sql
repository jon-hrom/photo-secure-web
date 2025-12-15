-- Add shooting_style_id column to client_projects table
ALTER TABLE t_p28211681_photo_secure_web.client_projects 
ADD COLUMN IF NOT EXISTS shooting_style_id TEXT;