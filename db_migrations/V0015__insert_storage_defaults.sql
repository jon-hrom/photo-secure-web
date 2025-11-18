INSERT INTO t_p28211681_photo_secure_web.storage_plans (name, quota_gb, monthly_price_rub, features_json, is_active) 
SELECT 'Старт', 5, 99, '{"maxFileSize": "25MB", "support": "email"}', true
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_plans WHERE name = 'Старт');

INSERT INTO t_p28211681_photo_secure_web.storage_plans (name, quota_gb, monthly_price_rub, features_json, is_active) 
SELECT 'Базовый', 20, 199, '{"maxFileSize": "25MB", "support": "email+chat"}', true
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_plans WHERE name = 'Базовый');

INSERT INTO t_p28211681_photo_secure_web.storage_plans (name, quota_gb, monthly_price_rub, features_json, is_active) 
SELECT 'Профи', 100, 699, '{"maxFileSize": "50MB", "support": "priority"}', true
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_plans WHERE name = 'Профи');

INSERT INTO t_p28211681_photo_secure_web.storage_plans (name, quota_gb, monthly_price_rub, features_json, is_active) 
SELECT 'Бизнес', 300, 1690, '{"maxFileSize": "100MB", "support": "dedicated"}', true
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_plans WHERE name = 'Бизнес');

INSERT INTO t_p28211681_photo_secure_web.storage_settings (key, value, description) 
SELECT 'max_upload_mb', '25', 'Maximum file size for upload in MB'
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_settings WHERE key = 'max_upload_mb');

INSERT INTO t_p28211681_photo_secure_web.storage_settings (key, value, description) 
SELECT 'billing_rub_per_gb_month', '2.16', 'Billing rate per GB per month'
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_settings WHERE key = 'billing_rub_per_gb_month');

INSERT INTO t_p28211681_photo_secure_web.storage_settings (key, value, description) 
SELECT 'warning_threshold_80', 'true', 'Show warning at 80% usage'
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_settings WHERE key = 'warning_threshold_80');

INSERT INTO t_p28211681_photo_secure_web.storage_settings (key, value, description) 
SELECT 'warning_threshold_90', 'true', 'Show warning at 90% usage'
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_settings WHERE key = 'warning_threshold_90');

INSERT INTO t_p28211681_photo_secure_web.storage_settings (key, value, description) 
SELECT 'hard_limit_enabled', 'true', 'Block uploads when quota exceeded'
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_settings WHERE key = 'hard_limit_enabled');

INSERT INTO t_p28211681_photo_secure_web.storage_settings (key, value, description) 
SELECT 'allowed_mime_types', 'image/jpeg,image/png,image/webp,image/heic,image/heif', 'Allowed MIME types for uploads'
WHERE NOT EXISTS (SELECT 1 FROM t_p28211681_photo_secure_web.storage_settings WHERE key = 'allowed_mime_types');