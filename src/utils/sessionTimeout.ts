// Единый таймаут неактивности сессии для всего приложения.
// Значение берётся из настроек (session_timeout_minutes), по умолчанию 50 минут.
const DEFAULT_MINUTES = 50;
const SETTINGS_URL = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=session_timeout_minutes';

let timeoutMs = DEFAULT_MINUTES * 60 * 1000;
let loadPromise: Promise<number> | null = null;

export const getSessionTimeoutMs = (): number => timeoutMs;

export const loadSessionTimeout = (): Promise<number> => {
  if (!loadPromise) {
    loadPromise = fetch(SETTINGS_URL)
      .then(r => r.json())
      .then(data => {
        const minutes = Number(data?.value);
        if (minutes && minutes > 0) timeoutMs = minutes * 60 * 1000;
        return timeoutMs;
      })
      .catch(() => timeoutMs);
  }
  return loadPromise;
};

loadSessionTimeout();

// Продлевает сохранённую сессию (скользящее окно) — вызывается при реальной активности
// пользователя на ЛЮБОЙ странице сайта, чтобы главная не считала сессию истёкшей.
export const touchStoredSession = (now: number = Date.now()): boolean => {
  try {
    const raw = localStorage.getItem('authSession');
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (typeof session.expiresAt === 'number' && session.expiresAt > 0 && now >= session.expiresAt) {
      return false; // уже истекла — не «оживляем»
    }
    localStorage.setItem('authSession', JSON.stringify({
      ...session,
      lastActivity: now,
      expiresAt: now + timeoutMs,
    }));
    return true;
  } catch {
    return false;
  }
};

// Последняя активность по данным localStorage (общая для всех вкладок).
export const getStoredLastActivity = (): number => {
  try {
    const raw = localStorage.getItem('authSession');
    if (!raw) return 0;
    return JSON.parse(raw).lastActivity || 0;
  } catch {
    return 0;
  }
};
