ALTER TABLE t_p28211681_photo_secure_web.clients 
  ADD COLUMN IF NOT EXISTS reserve_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.reserve_transactions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES t_p28211681_photo_secure_web.clients(id),
  user_id VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL,
  source_payment_id BIGINT NULL REFERENCES t_p28211681_photo_secure_web.client_payments(id),
  target_project_id BIGINT NULL REFERENCES t_p28211681_photo_secure_web.client_projects(id),
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reserve_tx_client ON t_p28211681_photo_secure_web.reserve_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_reserve_tx_user ON t_p28211681_photo_secure_web.reserve_transactions(user_id);
