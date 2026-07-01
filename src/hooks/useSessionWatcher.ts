import { useEffect } from 'react';
import { isAdminViewingSessionValid } from '@/utils/sessionCleanup';

/**
 * Хук для отслеживания состояния сессии
 * Автоматически очищает admin viewing session при logout
 */
export const useSessionWatcher = () => {
  useEffect(() => {
    // Проверяем валидность при монтировании
    if (!isAdminViewingSessionValid()) {
      console.log('[SESSION_WATCHER] Admin viewing session invalidated on mount');
    }

    // Слушаем изменения в localStorage (работает между вкладками)
    const handleStorageChange = (e: StorageEvent) => {
      // Сигнал выхода из другой вкладки — разлогиниваем и эту вкладку.
      // e.newValue !== null означает, что ключ был установлен (а не очищен самим logout).
      if (e.key === 'logout_broadcast' && e.newValue) {
        console.log('[SESSION_WATCHER] Logout broadcast received — logging out this tab');
        localStorage.removeItem('admin_viewing_user_id');
        localStorage.removeItem('admin_viewing_user');
        // Жёсткий выход на страницу входа: заменяем запись в истории,
        // чтобы кнопка «Назад» не вернула страницу вышедшего пользователя.
        window.location.replace('/?logout=true');
        return;
      }

      // Реагируем на удаление ключей авторизации
      if (
        e.key === 'authSession' ||
        e.key === 'vk_user' ||
        e.key === 'google_user' ||
        e.key === 'yandex_user'
      ) {
        console.log('[SESSION_WATCHER] Auth key changed/removed:', e.key);

        // Если ключ авторизации был удалён в другой вкладке (вышел пользователь) —
        // и здесь больше нет активной сессии, выходим на страницу входа.
        const stillLoggedIn =
          localStorage.getItem('authSession') ||
          localStorage.getItem('vk_user') ||
          localStorage.getItem('google_user') ||
          localStorage.getItem('yandex_user');

        if (e.newValue === null && !stillLoggedIn) {
          console.log('[SESSION_WATCHER] Session cleared in another tab — logging out');
          localStorage.removeItem('admin_viewing_user_id');
          localStorage.removeItem('admin_viewing_user');
          window.location.replace('/?logout=true');
          return;
        }

        // Если сессия стала невалидной - очищаем admin viewing
        if (!isAdminViewingSessionValid()) {
          console.log('[SESSION_WATCHER] Clearing admin viewing session due to auth change');
          localStorage.removeItem('admin_viewing_user_id');
          localStorage.removeItem('admin_viewing_user');
          
          // Перезагружаем страницу, чтобы применить изменения
          window.location.reload();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
};