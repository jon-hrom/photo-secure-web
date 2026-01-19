-- Add video_url column to client_messages table
ALTER TABLE t_p28211681_photo_secure_web.client_messages
ADD COLUMN IF NOT EXISTS video_url TEXT;