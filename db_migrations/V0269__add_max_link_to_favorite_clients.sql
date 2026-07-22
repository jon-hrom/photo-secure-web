ALTER TABLE t_p28211681_photo_secure_web.favorite_clients
ADD COLUMN IF NOT EXISTS max_link character varying(255) NULL;

COMMENT ON COLUMN t_p28211681_photo_secure_web.favorite_clients.max_link IS 'Ник или ссылка клиента в мессенджере MAX (необязательно). По номеру телефона MAX писать не умеет.';