-- Шаблон для уведомления фотографу о перемещении папки в корзину при истечении ссылки
INSERT INTO t_p28211681_photo_secure_web.max_service_templates
  (template_type, template_text, variables, is_active)
VALUES (
  'link_expired_folder_trashed',
  E'🗑 Папка перемещена в корзину\n\nЗдравствуйте, {photographer_name}!\n\nСрок действия общей ссылки на папку «{folder_name}» истёк {expired_date}. Папка автоматически перемещена в корзину фото-банка.\n\n⏳ У вас есть 7 дней (до {restore_until}), чтобы восстановить папку. После этого все фотографии будут удалены без возможности восстановления.\n\n📂 Восстановить можно в разделе «Фото-банк → Корзина»:\n{trash_url}\n\n———\n🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!',
  '["photographer_name","folder_name","expired_date","restore_until","trash_url"]'::jsonb,
  TRUE
)
ON CONFLICT (template_type) DO UPDATE
  SET template_text = EXCLUDED.template_text,
      variables = EXCLUDED.variables,
      is_active = TRUE,
      updated_at = CURRENT_TIMESTAMP;

-- Колонка чтобы не отправлять уведомление повторно
ALTER TABLE t_p28211681_photo_secure_web.folder_short_links
  ADD COLUMN IF NOT EXISTS expired_trash_notified_at timestamp without time zone NULL;