# Настройка Google Calendar API

## Проблема
Синхронизация с Google Calendar не работает, потому что:
1. ❌ В таблице `google_users` нет колонок для OAuth токенов (ИСПРАВЛЕНО ✅)
2. ❌ Google Cloud Console не настроен для Calendar API
3. ❌ В secrets нет правильных OAuth credentials с Calendar scope

## Решение

### 1. Настройка Google Cloud Console

Перейдите: https://console.cloud.google.com/apis/credentials

#### Шаг 1: Включите Google Calendar API
1. Откройте https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
2. Нажмите **"Включить"** (Enable)

#### Шаг 2: Настройте OAuth Consent Screen
1. Перейдите: APIs & Services → OAuth consent screen
2. Выберите **External** (если ещё не настроено)
3. Заполните:
   - App name: `foto-mix` (или ваше название)
   - User support email: ваш email
   - Developer contact: ваш email
4. В разделе **Scopes** добавьте:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
5. Сохраните

#### Шаг 3: Создайте или обновите OAuth 2.0 Client ID
1. Перейдите: APIs & Services → Credentials
2. Найдите существующий OAuth 2.0 Client ID или создайте новый
3. **Критично!** Добавьте Redirect URI:
   ```
   https://p28211681.poehali.work/api/google-calendar-callback
   ```
4. Скопируйте:
   - **Client ID** → сохраните в секрет `GOOGLE_CLIENT_ID`
   - **Client Secret** → сохраните в секрет `GOOGLE_CLIENT_SECRET`

### 2. Обновите секреты в проекте

Убедитесь, что в проекте есть секреты:

| Секрет | Значение | Откуда взять |
|--------|----------|--------------|
| `GOOGLE_CLIENT_ID` | Ваш Client ID | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | Ваш Client Secret | Google Cloud Console → Credentials |
| `BASE_URL` | `https://p28211681.poehali.work` | URL вашего сайта |

⚠️ **Важно:** `BASE_URL` должен совпадать с Redirect URI в Google Console!

### 3. Как использовать

После настройки:

1. Зайдите в **Настройки** на сайте
2. Найдите раздел **Google Calendar**
3. Нажмите **"Подключить Google Calendar"**
4. Разрешите доступ в Google OAuth окне
5. После успеха окно закроется автоматически

Теперь при добавлении проекта с датой съёмки:
- ✅ Включите чекбокс **"Добавить в календарь"**
- ✅ Событие автоматически создастся в Google Calendar
- ✅ Напоминания за день и за час до съёмки

## Техническая информация

### База данных
Миграция `V0068__add_google_calendar_tokens.sql` добавила колонки:
- `access_token` — OAuth токен для API запросов
- `refresh_token` — для обновления access_token
- `token_expires_at` — время истечения токена
- `calendar_enabled` — флаг активности календаря
- `calendar_scopes` — предоставленные OAuth scopes

### Backend функции
- `google-calendar-connect` — OAuth flow для подключения календаря
  - **GET** (без `code`) → возвращает OAuth URL
  - **GET** (с `code`) → обрабатывает callback, сохраняет токены
  - **POST** → проверяет статус подключения
  
- `calendar-sync` — синхронизация проектов с календарём
  - **POST** → создаёт/обновляет событие в Calendar
  - **DELETE** → удаляет событие из Calendar

### Фронтенд
- `GoogleCalendarConnect.tsx` — компонент для подключения в настройках
- `ProjectHandlers.tsx` → автоматически вызывает `calendar-sync` при включении чекбокса

## Troubleshooting

### Ошибка "redirect_uri_mismatch"
➡️ Проверьте, что `BASE_URL` в секретах совпадает с Redirect URI в Google Console

### Ошибка "access_denied" или "invalid_scope"
➡️ Убедитесь, что в OAuth Consent Screen добавлены Calendar scopes

### Токен истёк
➡️ Нажмите "Переподключить" в настройках — система автоматически обновит токен через refresh_token

### События не создаются
1. Проверьте логи: `backend/calendar-sync` — должно быть `project_id` и `user_id`
2. Убедитесь, что `calendar_enabled = TRUE` в таблице `google_users`
3. Проверьте, что в проекте включён чекбокс "Добавить в календарь"
