ALTER TABLE t_p28211681_photo_secure_web.storage_plans
ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN t_p28211681_photo_secure_web.storage_plans.duration_days IS 'Срок действия тарифа в днях. 30 = месяц. Цена указана за весь срок.';