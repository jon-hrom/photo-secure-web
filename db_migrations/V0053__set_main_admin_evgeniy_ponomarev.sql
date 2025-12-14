-- Назначаем Пономарёва Евгения (jonhrom2012@gmail.com) главным администратором
UPDATE t_p28211681_photo_secure_web.users 
SET role = 'admin' 
WHERE email = 'jonhrom2012@gmail.com';

-- Комментарий
COMMENT ON TABLE t_p28211681_photo_secure_web.users IS 'Главный администратор: Пономарёв Евгений (jonhrom2012@gmail.com)';