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
      // Реагируем на удаление ключей авторизации
      if (
        e.key === 'authSession' ||
        e.key === 'vk_user' ||
        e.key === 'google_user'
      ) {
        console.log('[SESSION_WATCHER] Auth key changed/removed:', e.key);
        
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
