UPDATE t_p28211681_photo_secure_web.max_service_templates
SET template_text = template_text || E'\n\n———\n🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!',
    updated_at = CURRENT_TIMESTAMP
WHERE template_type IN ('booking_reminder','new_booking','password_reset','payment_received','project_ready')
  AND template_text NOT LIKE '%автоматическ%';