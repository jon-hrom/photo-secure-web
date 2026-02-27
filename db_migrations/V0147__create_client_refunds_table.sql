
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.client_refunds (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES t_p28211681_photo_secure_web.clients(id),
    payment_id BIGINT REFERENCES t_p28211681_photo_secure_web.client_payments(id),
    project_id BIGINT REFERENCES t_p28211681_photo_secure_web.client_projects(id),
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    type VARCHAR(20) NOT NULL DEFAULT 'refund',
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    method VARCHAR(50),
    refund_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_system_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_refunds_client_id ON t_p28211681_photo_secure_web.client_refunds(client_id);
CREATE INDEX idx_client_refunds_payment_id ON t_p28211681_photo_secure_web.client_refunds(payment_id);
CREATE INDEX idx_client_refunds_project_id ON t_p28211681_photo_secure_web.client_refunds(project_id);

COMMENT ON TABLE t_p28211681_photo_secure_web.client_refunds IS 'Возвраты и аннулирования платежей';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_refunds.type IS 'Тип: refund (возврат), cancellation (аннулирование)';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_refunds.status IS 'Статус: completed, pending, rejected';
COMMENT ON COLUMN t_p28211681_photo_secure_web.client_refunds.payment_system_id IS 'ID транзакции в платёжной системе (для будущей интеграции)';
