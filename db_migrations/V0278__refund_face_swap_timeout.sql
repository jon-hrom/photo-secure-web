UPDATE t_p28211681_photo_secure_web.users SET energy_balance = COALESCE(energy_balance,0) + 30 WHERE id = 12;
INSERT INTO t_p28211681_photo_secure_web.energy_transactions (user_id, amount, type, rub_amount, description)
VALUES (12, 30, 'refund', 0, 'Возврат: перенос лица оборвался по таймауту (26.09 17:16)');