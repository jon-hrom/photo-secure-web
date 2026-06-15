-- Заполняем историю версий начальными документами (если ещё нет)
INSERT INTO t_p28211681_photo_secure_web.legal_document_versions (document_id, slug, version, title, content, published_at)
SELECT d.id, d.slug, d.version, d.title, d.content, d.published_at
FROM t_p28211681_photo_secure_web.legal_documents d
WHERE NOT EXISTS (
    SELECT 1 FROM t_p28211681_photo_secure_web.legal_document_versions v
    WHERE v.document_id = d.id AND v.version = d.version
);