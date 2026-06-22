-- Тип обращения в чате поддержки: support (обычное) или registration_request (заявка на регистрацию)
ALTER TABLE t_p28211681_photo_secure_web.blocked_user_appeals
  ADD COLUMN IF NOT EXISTS appeal_type VARCHAR(40) NOT NULL DEFAULT 'support';
