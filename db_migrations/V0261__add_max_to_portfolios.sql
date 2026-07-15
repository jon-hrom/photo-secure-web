ALTER TABLE t_p28211681_photo_secure_web.portfolios
ADD COLUMN IF NOT EXISTS max character varying(200) NULL DEFAULT ''::character varying;