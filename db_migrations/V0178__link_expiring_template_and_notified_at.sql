-- Колонка для идемпотентной отправки уведомлений об истечении ссылки
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
  ADD COLUMN IF NOT EXISTS expire_notified_at timestamp without time zone NULL;

-- Шаблон MAX-сообщения о скором истечении срока действия ссылки
INSERT INTO t_p28211681_photo_secure_web.max_service_templates
  (template_type, template_text, variables, is_active)
VALUES (
  'link_expiring',
  E'⏳ Срок действия ссылки скоро истечёт\n\nЗдравствуйте! Ссылка «{link_title}» подходит к завершению — она будет действовать ещё {days_left} дн. (до {expires_date}).\n\nПо истечении этого срока доступ будет полностью закрыт, а фотографии удалены без возможности восстановления.\n\n📥 Пожалуйста, скачайте фото, если ещё не успели:\n{link_url}\n\nЕсли возникли вопросы, можно написать фотографу — {photographer_link}\n\n———\n🤖 Сообщение сформировано автоматической системой, отвечать на него не нужно.',
  '["link_title","days_left","expires_date","link_url","photographer_link"]'::jsonb,
  TRUE
)
ON CONFLICT (template_type) DO UPDATE
  SET template_text = EXCLUDED.template_text,
      variables = EXCLUDED.variables,
      is_active = TRUE,
      updated_at = CURRENT_TIMESTAMP;