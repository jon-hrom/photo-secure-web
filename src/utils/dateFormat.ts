/**
 * Утилиты для форматирования дат с учетом часового пояса ФОТОГРАФА
 * (регион из настроек, а не системное время устройства)
 */

import { getTimezoneForRegion } from './regionTimezone';

/**
 * Часовой пояс фотографа (из его региона в настройках).
 * Если регион не задан — используется системный пояс устройства.
 */
export const getPhotographerTimeZone = (): string | undefined => {
  try {
    const region = localStorage.getItem('user_region');
    if (!region) return undefined;
    return getTimezoneForRegion(region);
  } catch {
    return undefined;
  }
};

/**
 * Разбирает дату из backend. Наивные строки без зоны считаем UTC.
 */
export const parseBackendDate = (dateStr: string | Date): Date => {
  if (dateStr instanceof Date) return dateStr;
  const raw = String(dateStr).trim();
  const isNaive = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw);
  return new Date(isNaive ? `${raw.replace(' ', 'T')}Z` : raw);
};

/** Части даты/времени в часовом поясе фотографа */
const getTzParts = (date: Date) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: getPhotographerTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p: Record<string, string> = {};
  fmt.formatToParts(date).forEach((part) => {
    p[part.type] = part.value;
  });
  return p;
};

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
    const date = parseBackendDate(dateStr);
    const timeZone = getPhotographerTimeZone();

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
          month: 'short',
          timeZone
        });

      case 'short':
        // Короткий формат: 09.01.2026 14:30
        return date.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone
        });

      case 'date':
        // Только дата: 9 января 2026
        return date.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone
        });

      case 'time':
        // Только время: 14:30
        return date.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone
        });

      case 'full':
      default:
        // Полный формат: 9 января 2026, 14:30
        return date.toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone
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
    const date = parseBackendDate(dateStr);
    
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
 * Форматирует длительность съёмки, заданную в минутах
 * @example 45 → "45 мин", 120 → "2 ч", 90 → "1 ч 30 мин"
 */
export const formatMinutes = (minutes?: number | string | null): string => {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return '—';

  const rounded = Math.round(total);
  if (rounded < 60) return `${rounded} мин`;

  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
};

/**
 * Возвращает локализованное название часового пояса пользователя
 * @example "GMT+3 (Москва)" или "GMT-5 (Нью-Йорк)"
 */
export const getUserTimezone = (): string => {
  try {
    const timezone = getPhotographerTimeZone() || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const tzName = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value;
    return `${tzName || 'GMT'} (${timezone})`;
  } catch {
    return 'Местное время';
  }
};

/**
 * Конвертирует UTC дату в локальный ISO string для <input type="datetime-local">
 */
export const utcToLocalInput = (utcDate: string | Date): string => {
  try {
    const date = parseBackendDate(utcDate);
    
    if (isNaN(date.getTime())) {
      return '';
    }

    // Время в часовом поясе фотографа для input
    const p = getTzParts(date);
    return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
  } catch (error) {
    console.error('[DATE_FORMAT] Error converting UTC to local input:', error);
    return '';
  }
};

/**
 * Конвертирует локальный input в UTC ISO string для отправки на backend
 */
export const todayLocalDate = (): string => {
  const p = getTzParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
};

/** Текущее время в часовом поясе фотографа, в формате HH:MM */
export const nowLocalTime = (): string => {
  const p = getTzParts(new Date());
  return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
};

export const localInputToUtc = (localInput: string): string => {
  try {
    if (!localInput) return '';

    const timeZone = getPhotographerTimeZone();
    if (!timeZone) {
      const d = new Date(localInput);
      return isNaN(d.getTime()) ? '' : d.toISOString();
    }

    // Трактуем ввод как время в поясе фотографа
    const asUtc = new Date(`${localInput.length === 16 ? localInput : localInput.slice(0, 16)}:00Z`);
    if (isNaN(asUtc.getTime())) return '';

    const shown = new Date(asUtc.toLocaleString('en-US', { timeZone }));
    const utcRef = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMs = shown.getTime() - utcRef.getTime();

    return new Date(asUtc.getTime() - offsetMs).toISOString();
  } catch (error) {
    console.error('[DATE_FORMAT] Error converting local input to UTC:', error);
    return '';
  }
};