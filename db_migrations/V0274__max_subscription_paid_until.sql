CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.max_subscription (
    id INTEGER PRIMARY KEY DEFAULT 1,
    paid_until DATE,
    note TEXT,
    notified_3d_at DATE,
    notified_1d_at DATE,
    notified_0d_at DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT max_subscription_single_row CHECK (id = 1)
);

INSERT INTO t_p28211681_photo_secure_web.max_subscription (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;