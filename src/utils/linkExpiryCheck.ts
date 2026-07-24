const MAX_URL = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';
const COOLDOWN_MS = 30 * 60 * 1000; // не чаще одного прогона раз в 30 минут
const STORAGE_KEY = 'last_link_expiry_check_all';

/**
 * Глобальная проверка истекающих общих ссылок по ВСЕМ фотографам.
 * Запускается при заходе на сайт любого посетителя (фотограф, клиент, гость по ссылке).
 * Не требует авторизации. Защищена от частых вызовов через localStorage-кулдаун.
 */
export function runGlobalLinkExpiryCheck(): void {
  try {
    const last = Number(localStorage.getItem(STORAGE_KEY) || '0');
    if (Date.now() - last < COOLDOWN_MS) return;
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    // localStorage может быть недоступен — просто продолжаем
  }

  const call = (action: string) =>
    fetch(MAX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
      .then((r) => r.json())
      .catch(() => {});

  call('check_expiring_links_all');
  call('trash_expired_folders_all');
}
