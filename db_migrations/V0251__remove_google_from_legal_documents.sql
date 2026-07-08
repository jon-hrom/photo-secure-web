-- Удаление упоминаний входа через Google из юридических документов
-- (вход через Google отключён на сайте)

-- confidentiality: убрать Google из списка сервисов авторизации
UPDATE t_p28211681_photo_secure_web.legal_documents
SET content = replace(content, 'Яндекс, ВКонтакте (VK ID), Google, Telegram', 'Яндекс, ВКонтакте (VK ID), Telegram'),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'confidentiality';

-- offer: убрать Google из перечня внешних сервисов авторизации
UPDATE t_p28211681_photo_secure_web.legal_documents
SET content = replace(content, 'Яндекс, ВКонтакте, Google, Телеграмм', 'Яндекс, ВКонтакте, Телеграмм'),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'offer';

-- personal-data: три упоминания
UPDATE t_p28211681_photo_secure_web.legal_documents
SET content = replace(content, '<p>Google;</p>', ''),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'personal-data';

UPDATE t_p28211681_photo_secure_web.legal_documents
SET content = replace(content, 'Яндекс, VK ID, Google, Telegram', 'Яндекс, VK ID, Telegram'),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'personal-data';

UPDATE t_p28211681_photo_secure_web.legal_documents
SET content = replace(content, 'включая Google и Telegram', 'включая Telegram'),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'personal-data';
