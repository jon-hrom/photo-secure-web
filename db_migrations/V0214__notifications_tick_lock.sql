-- Глобальный замок для диспетчера уведомлений (throttle realtime + cron)
CREATE TABLE IF NOT EXISTS t_p28211681_photo_secure_web.notifications_tick_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_source VARCHAR(20),
    runs_count INTEGER DEFAULT 0,
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO t_p28211681_photo_secure_web.notifications_tick_lock (id, last_run_at, runs_count)
VALUES (1, NULL, 0)
ON CONFLICT (id) DO NOTHING;