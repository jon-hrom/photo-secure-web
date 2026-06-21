CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.recurring_consent_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  plan_name VARCHAR(100),
  amount_rub NUMERIC(10,2) NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 1,
  consent_text TEXT NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  offer_version VARCHAR(20) DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_consent_log_user_id ON t_p28211681_photo_secure_web.recurring_consent_log(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_consent_log_created_at ON t_p28211681_photo_secure_web.recurring_consent_log(created_at);
