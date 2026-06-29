ALTER TABLE t_p28211681_photo_secure_web.client_projects
ADD COLUMN IF NOT EXISTS studio_hourly_rate numeric(10,2) NULL;

COMMENT ON COLUMN t_p28211681_photo_secure_web.client_projects.studio_hourly_rate IS 'Стоимость аренды студии за час (входит в бюджет, но не в чистый доход фотографа)';