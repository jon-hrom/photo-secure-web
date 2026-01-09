# Обновление системы отображения времени

## Что изменилось

Все даты и время на сайте теперь **автоматически показываются в местном времени пользователя** (по его часовому поясу).

## Принцип работы

### Backend (Без изменений)
- Все даты хранятся и обрабатываются в **UTC** (универсальное время)
- PostgreSQL использует ISO 8601 format: `2026-01-09T14:30:00Z`
- Оповещения, expires_at, session timeout — всё работает на UTC корректно

### Frontend (Обновлено)
- Все даты конвертируются в **местное время браузера** при отображении
- Используется API `Intl.DateTimeFormat` и `toLocaleString()` под капотом
- Пользователь видит время в своей временной зоне автоматически

## Новые утилиты

Файл: `src/utils/dateFormat.ts`

### Функции

#### 1. `formatLocalDate(dateStr, format)`
Основная функция для форматирования дат.

**Форматы:**
- `'full'` (по умолчанию) → "9 января 2026, 14:30"
- `'short'` → "09.01.2026 14:30"
- `'date'` → "9 января 2026"
- `'time'` → "14:30"
- `'relative'` → "2 ч. назад", "только что", "вчера"

**Пример:**
```typescript
import { formatLocalDate } from '@/utils/dateFormat';

// UTC дата из backend
const utcDate = "2026-01-09T14:30:00Z";

// Автоматически конвертируется в местное время
formatLocalDate(utcDate, 'short'); // "09.01.2026 17:30" (в GMT+3)
formatLocalDate(utcDate, 'full');  // "9 января 2026, 17:30" (в GMT+3)
```

#### 2. `formatTimeRemaining(dateStr)`
Для отображения "сколько осталось" (expires_at, deadlines)

**Пример:**
```typescript
formatTimeRemaining("2026-01-09T18:00:00Z"); 
// → "истекает через 3 ч" или "истек 2 ч. назад"
```

#### 3. `formatDuration(startDate, endDate)`
Для длительности (сессии, проекты)

**Пример:**
```typescript
formatDuration("2026-01-09T14:00:00Z", "2026-01-09T16:30:00Z");
// → "2 ч 30 мин"
```

#### 4. `getUserTimezone()`
Возвращает часовой пояс пользователя

**Пример:**
```typescript
getUserTimezone(); // → "GMT+3 (Europe/Moscow)"
```

#### 5. `utcToLocalInput(utcDate)` и `localInputToUtc(localInput)`
Для работы с `<input type="datetime-local">`

**Пример:**
```typescript
// Backend → Input
utcToLocalInput("2026-01-09T14:30:00Z"); // → "2026-01-09T17:30"

// Input → Backend
localInputToUtc("2026-01-09T17:30"); // → "2026-01-09T14:30:00.000Z"
```

## Обновленные компоненты

Следующие компоненты уже обновлены для работы с местным временем:

### Критичные (✅ Обновлены)
1. **src/components/settings/ActiveSessionsCard.tsx** — активные сессии
2. **src/components/clients/calendar/UpcomingBookingsList.tsx** — предстоящие встречи
3. **src/components/clients/BookingDialogs.tsx** — диалоги бронирований
4. **src/components/clients/detail/MessageHistory.tsx** — история сообщений
5. **src/components/photobook/SavedDesigns.tsx** — сохраненные дизайны
6. **src/components/admin/AdminUsers.tsx** — управление пользователями
7. **src/components/admin/AdminNotifications.tsx** — уведомления админа
8. **src/components/admin/AdminPanelHistory.tsx** — история изменений
9. **src/components/admin/UserDetailsModal.tsx** — детали пользователя

### Требуют обновления (⚠️ TODO)
Следующие файлы используют даты, но пока НЕ обновлены (требуют проверки):

- src/components/admin/EnhancedAdminUsers.tsx
- src/components/admin/PromoCodesTab.tsx
- src/components/admin/FinancialTab.tsx
- src/components/admin/AdminClientsTab.tsx
- src/components/admin/AdminStorageStats.tsx
- src/components/photobook/editor/EditorTopToolbar.tsx
- src/components/photobook/Photobook3DPreview.tsx
- src/components/BookingDetailsDialog.tsx
- src/components/photobank/camera-upload/CameraUploadFileList.tsx
- src/components/photobank/PhotoExifDialog.tsx
- src/components/photobank/CameraUploadDialog.tsx
- src/components/photobank/PhotoBankFoldersList.tsx
- src/components/settings/MAXConnectionCard.tsx
- src/components/settings/GoogleCalendarConnect.tsx
- src/components/settings/MultiEmailCard.tsx
- src/components/clients/ClientCard.tsx
- src/components/clients/dialog/PaymentHandlers.tsx
- src/components/clients/dialog/UtilityHandlers.tsx
- src/components/clients/detail/ClientDetailProjects.tsx
- src/components/clients/detail/ClientDetailPayments.tsx
- src/components/clients/detail/ClientDetailOverview.tsx
- src/components/clients/detail/ClientDetailMessages.tsx
- src/components/clients/ClientsExportDialog.tsx
- src/components/clients/UnsavedProjectDialog.tsx
- src/components/clients/ProjectArchiveDialog.tsx
- src/components/clients/ClientsListSection.tsx
- src/components/dashboard/DashboardUpcomingBookings.tsx
- src/components/dashboard/DashboardBookingDetailsDialog.tsx
- src/components/dashboard/DashboardProjectDetailsDialog.tsx
- src/pages/MyFiles.tsx

## Как обновить старый компонент

### Шаг 1: Добавить импорт
```typescript
import { formatLocalDate } from '@/utils/dateFormat';
```

### Шаг 2: Заменить старый код

**Было:**
```typescript
new Date(booking.date).toLocaleString('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});
```

**Стало:**
```typescript
formatLocalDate(booking.date, 'short');
```

### Шаг 3: Удалить локальные функции formatDate
Если в файле есть своя функция `formatDate()`, её можно удалить — используйте `formatLocalDate` напрямую.

## Тестирование

### Как проверить что всё работает

1. **Локально (Chrome DevTools):**
   - F12 → Console
   - `Intl.DateTimeFormat().resolvedOptions().timeZone` — текущий часовой пояс
   - Временно изменить: Settings → Sensors → Location → выбрать другой город

2. **Разные часовые пояса:**
   - Москва (GMT+3): "09.01.2026 17:30"
   - Нью-Йорк (GMT-5): "09.01.2026 09:30"
   - Токио (GMT+9): "09.01.2026 23:30"
   - Все видят **одно и то же событие**, но в своем локальном времени

3. **Проверка корректности:**
   - Создайте сессию → проверьте время создания в ActiveSessionsCard
   - Создайте booking → проверьте в календаре
   - Время должно совпадать с вашими часами (а не с серверным UTC)

## Важные замечания

⚠️ **НЕ трогать:**
- Backend логику (всё остаётся в UTC)
- Database схему и запросы
- Expires_at вычисления (работают корректно в UTC)
- Session timeout логику

✅ **Обновлять только:**
- Отображение дат для пользователя (frontend)
- UI компоненты где видны даты
- Форматирование в таблицах, карточках, списках

## GPS геолокация + Время

Система геолокации (`src/utils/geolocation.ts`) теперь работает вместе с локальным временем:
- GPS определяет город пользователя → Тольятти (GMT+4)
- Даты автоматически показываются в GMT+4
- Никаких дополнительных настроек не требуется

## Поддержка

Если нужно обновить ещё файлы — используйте шаблон выше. Все изменения минимальны и не ломают существующий код.
