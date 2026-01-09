/**
 * Утилиты для форматирования дат с учетом часового пояса пользователя
 */

/**
 * Форматирует ISO строку даты в локальное время пользователя
 * @param dateStr - ISO строка даты (UTC из backend)
 * @param format - 'full' | 'short' | 'date' | 'time' | 'relative'
 * @returns Строка с датой в местном времени
 */
export const formatLocalDate = (
  dateStr: string | null | undefined,
  format: 'full' | 'short' | 'date' | 'time' | 'relative' = 'full'
): string => {
  if (!dateStr) return '—';

  try {
    const date = new Date(dateStr);
    
    // Проверка на валидность даты
    if (isNaN(date.getTime())) {
      return dateStr;
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    switch (format) {
      case 'relative':
        // Относительное время (для постов, комментариев)
        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин. назад`;
        if (diffHours < 24) return `${diffHours} ч. назад`;
        if (diffDays < 7) return `${diffDays} дн. назад`;
        
        // Если больше недели - показываем дату
        return date.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short'
        });

      case 'short':
        // Короткий формат: 09.01.2026 14:30
        return date.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

      case 'date':
        // Только дата: 9 января 2026
        return date.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

      case 'time':
        // Только время: 14:30
        return date.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });

      case 'full':
      default:
        // Полный формат: 9 января 2026, 14:30
        return date.toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
    }
  } catch (error) {
    console.error('[DATE_FORMAT] Error formatting date:', error);
    return dateStr;
  }
};

/**
 * Форматирует время для отображения "сколько осталось" (expires_at)
 * @param dateStr - ISO строка даты истечения
 * @returns Строка типа "истекает через 25 мин" или "истек 2 ч. назад"
 */
export const formatTimeRemaining = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';

  try {
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      return dateStr;
    }

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(Math.abs(diffMs) / 60000);
    const diffHours = Math.floor(Math.abs(diffMs) / 3600000);
    const diffDays = Math.floor(Math.abs(diffMs) / 86400000);

    const isExpired = diffMs < 0;
    const prefix = isExpired ? 'истек' : 'истекает через';

    if (diffMins < 1) return isExpired ? 'истек' : 'истекает сейчас';
    if (diffMins < 60) return `${prefix} ${diffMins} мин`;
    if (diffHours < 24) return `${prefix} ${diffHours} ч`;
    return `${prefix} ${diffDays} дн`;
  } catch (error) {
    console.error('[DATE_FORMAT] Error formatting time remaining:', error);
    return dateStr;
  }
};

/**
 * Форматирует длительность (для сессий: "активна 2 ч. 15 мин.")
 * @param startDate - Дата начала
 * @param endDate - Дата окончания (по умолчанию - сейчас)
 */
export const formatDuration = (
  startDate: string | Date,
  endDate: string | Date = new Date()
): string => {
  try {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return '—';
    }

    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин`;
    if (diffHours < 24) {
      const mins = diffMins % 60;
      return mins > 0 ? `${diffHours} ч ${mins} мин` : `${diffHours} ч`;
    }
    
    const hours = diffHours % 24;
    return hours > 0 ? `${diffDays} дн ${hours} ч` : `${diffDays} дн`;
  } catch (error) {
    console.error('[DATE_FORMAT] Error formatting duration:', error);
    return '—';
  }
};

/**
 * Возвращает локализованное название часового пояса пользователя
 * @example "GMT+3 (Москва)" или "GMT-5 (Нью-Йорк)"
 */
export const getUserTimezone = (): string => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? '+' : '';
    return `GMT${sign}${offset} (${timezone})`;
  } catch {
    return 'Местное время';
  }
};

/**
 * Конвертирует UTC дату в локальный ISO string для <input type="datetime-local">
 */
export const utcToLocalInput = (utcDate: string | Date): string => {
  try {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    
    if (isNaN(date.getTime())) {
      return '';
    }

    // Получаем локальное время и форматируем для input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('[DATE_FORMAT] Error converting UTC to local input:', error);
    return '';
  }
};

/**
 * Конвертирует локальный input в UTC ISO string для отправки на backend
 */
export const localInputToUtc = (localInput: string): string => {
  try {
    if (!localInput) return '';
    
    // datetime-local возвращает строку без timezone, интерпретируется как local
    const localDate = new Date(localInput);
    
    if (isNaN(localDate.getTime())) {
      return '';
    }

    return localDate.toISOString();
  } catch (error) {
    console.error('[DATE_FORMAT] Error converting local input to UTC:', error);
    return '';
  }
};
