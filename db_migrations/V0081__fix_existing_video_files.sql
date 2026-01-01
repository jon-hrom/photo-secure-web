-- Update existing video files to have correct is_video flag and content_type
UPDATE photo_bank 
SET 
  is_video = true,
  content_type = CASE 
    WHEN LOWER(file_name) LIKE '%.mp4' THEN 'video/mp4'
    WHEN LOWER(file_name) LIKE '%.mov' THEN 'video/quicktime'
    WHEN LOWER(file_name) LIKE '%.avi' THEN 'video/x-msvideo'
    WHEN LOWER(file_name) LIKE '%.webm' THEN 'video/webm'
    WHEN LOWER(file_name) LIKE '%.mkv' THEN 'video/x-matroska'
    ELSE content_type
  END
WHERE 
  LOWER(file_name) LIKE '%.mp4' 
  OR LOWER(file_name) LIKE '%.mov' 
  OR LOWER(file_name) LIKE '%.avi' 
  OR LOWER(file_name) LIKE '%.webm' 
  OR LOWER(file_name) LIKE '%.mkv';