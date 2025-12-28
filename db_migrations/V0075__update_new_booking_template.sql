-- Обновляем шаблон "Новая бронь" на содержимое из "Подтверждение съёмки"
UPDATE t_p28211681_photo_secure_web.max_service_templates
SET 
    template_text = '📸 Новая бронь на фотосессию

🎬 Проект: {project_name}
📅 Дата: {date}
🕐 Время: {time}
📍 Адрес: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

Если у вас есть вопросы или нужно перенести съёмку, свяжитесь с фотографом.

До встречи! 🎥',
    variables = '["project_name","date","time","address","photographer_name","photographer_phone"]'::jsonb
WHERE template_type = 'new_booking';
