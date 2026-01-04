
-- Сбрасываем для теста строгой логики (хотя бы одно лицо с закрытыми глазами = брак)

UPDATE t_p28211681_photo_secure_web.photo_bank
SET tech_analyzed = FALSE,
    tech_reject_reason = NULL
WHERE user_id = 12 
  AND folder_id = 35
  AND is_trashed = FALSE;
