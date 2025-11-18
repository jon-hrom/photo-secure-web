ALTER TABLE t_p28211681_photo_secure_web.storage_plans 
ADD COLUMN IF NOT EXISTS visible_to_users BOOLEAN DEFAULT false;

COMMENT ON COLUMN t_p28211681_photo_secure_web.storage_plans.visible_to_users IS 'If true, plan is visible to users in tariff page';