CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.user_activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  action VARCHAR(255) NOT NULL,
  page_path VARCHAR(512) NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON t_p28211681_photo_secure_web.user_activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON t_p28211681_photo_secure_web.user_activity_log (created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_created ON t_p28211681_photo_secure_web.user_activity_log (user_id, created_at DESC);