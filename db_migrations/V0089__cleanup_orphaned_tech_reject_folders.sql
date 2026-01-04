-- Удаление осиротевших папок технического брака и их файлов
-- Шаг 1: Помечаем файлы в осиротевших папках как удалённые
UPDATE t_p28211681_photo_secure_web.photo_bank
SET is_trashed = TRUE, trashed_at = NOW()
WHERE folder_id IN (
  SELECT pf.id 
  FROM t_p28211681_photo_secure_web.photo_folders pf
  WHERE pf.parent_folder_id IS NOT NULL 
    AND pf.parent_folder_id NOT IN (
      SELECT id FROM t_p28211681_photo_secure_web.photo_folders
    )
);

-- Шаг 2: Помечаем осиротевшие папки как удалённые
UPDATE t_p28211681_photo_secure_web.photo_folders
SET is_trashed = TRUE, trashed_at = NOW()
WHERE parent_folder_id IS NOT NULL 
  AND parent_folder_id NOT IN (
    SELECT id FROM t_p28211681_photo_secure_web.photo_folders
  );