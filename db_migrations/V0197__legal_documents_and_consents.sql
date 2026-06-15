-- Документы (правовые): хранят текущую опубликованную версию
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.legal_documents (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    requires_consent BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- История версий документов
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.legal_document_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES t_p28211681_photo_secure_web.legal_documents(id),
    slug VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    published_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_by INTEGER NULL
);

-- Журнал согласий пользователей (152-ФЗ): кто, когда, какую версию документа принял
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.legal_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    slug VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    accepted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NULL
);
CREATE INDEX IF NOT EXISTS idx_legal_consents_user ON t_p28211681_photo_secure_web.legal_consents (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_consent ON t_p28211681_photo_secure_web.legal_consents (user_id, slug, version);

-- Начальные документы
INSERT INTO t_p28211681_photo_secure_web.legal_documents (slug, title, content, version, sort_order, requires_consent)
VALUES
  ('offer', 'Оферта', '<h1>Публичная оферта</h1><p>Исполнитель: самозанятый (НПД) Пономарев Е.В., ИНН 634502706508.</p><p>Текст оферты будет опубликован администратором.</p>', 1, 1, TRUE),
  ('privacy-policy', 'Политика конфиденциальности', '<h1>Политика конфиденциальности</h1><p>Оператор персональных данных: самозанятый (НПД) Пономарев Е.В., ИНН 634502706508.</p><p>Текст политики будет опубликован администратором.</p>', 1, 2, TRUE),
  ('personal-data', 'Обработка персональных данных', '<h1>Согласие на обработку персональных данных</h1><p>Оператор: самозанятый (НПД) Пономарев Е.В., ИНН 634502706508.</p><p>Текст согласия будет опубликован администратором.</p>', 1, 3, TRUE)
ON CONFLICT (slug) DO NOTHING;