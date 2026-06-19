-- Тариф "Старт" (id=1) по умолчанию для новых пользователей
ALTER TABLE t_p28211681_photo_secure_web.users
    ALTER COLUMN plan_id SET DEFAULT 1;

-- Починить существующих пользователей без тарифа: назначить Старт
UPDATE t_p28211681_photo_secure_web.users
SET plan_id = 1, updated_at = CURRENT_TIMESTAMP
WHERE plan_id IS NULL;