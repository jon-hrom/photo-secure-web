const AUDIT_API = 'https://functions.poehali.dev/2016162f-bf9b-41e9-a0eb-e2e4c8249795';

export interface ActivityEvent {
  event_type?: string; // 'page_view' | 'click' | 'action'
  act: string; // что произошло, человекочитаемо
  page_path?: string;
  details?: unknown;
}

let lastPagePath = '';

/**
 * Записать событие активности пользователя (в фоне, не блокирует UI).
 */
export function logActivity(ev: ActivityEvent): void {
  const userId = localStorage.getItem('userId');
  if (!userId) return;
  try {
    fetch(AUDIT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({
        action: 'log',
        user_id: Number(userId),
        event_type: ev.event_type || 'action',
        act: ev.act,
        page_path: ev.page_path,
        details: ev.details ?? null,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // молча игнорируем — логирование не должно ломать приложение
  }
}

/**
 * Записать просмотр страницы. Дедуплицирует повторные вызовы того же пути.
 */
export function logPageView(path: string, title?: string): void {
  if (path === lastPagePath) return;
  lastPagePath = path;
  logActivity({
    event_type: 'page_view',
    act: title ? `Открыл: ${title}` : `Открыл страницу ${path}`,
    page_path: path,
  });
}

/**
 * Записать клик/действие по кнопке.
 */
export function logClick(label: string, details?: unknown): void {
  logActivity({
    event_type: 'click',
    act: label,
    page_path: window.location.pathname,
    details,
  });
}
