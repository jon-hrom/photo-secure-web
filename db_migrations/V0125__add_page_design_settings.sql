
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
ADD COLUMN IF NOT EXISTS cover_photo_id integer NULL,
ADD COLUMN IF NOT EXISTS cover_orientation varchar(20) NULL DEFAULT 'horizontal',
ADD COLUMN IF NOT EXISTS cover_focus_x real NULL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS cover_focus_y real NULL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS grid_gap integer NULL DEFAULT 8;
