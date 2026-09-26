UPDATE t_p28211681_photo_secure_web.users SET energy_balance = COALESCE(energy_balance,0) + 60 WHERE id = 12;
INSERT INTO t_p28211681_photo_secure_web.energy_transactions (user_id, amount, type, rub_amount, description)
VALUES (12, 60, 'refund', 0, 'Возврат: 2 переноса лица оборвались при сборке результата (26.09 17:31, 17:32)');