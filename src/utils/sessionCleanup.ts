/**
 * Централизованная очистка сессии
 * Всегда используйте эту функцию вместо прямого removeItem
 */
export const clearUserSession = () => {
  console.log('[SESSION_CLEANUP] Clearing all session data');
  
  // Очищаем основные данные авторизации
  localStorage.removeItem('authSession');
  localStorage.removeItem('vk_user');
  localStorage.removeItem('google_user');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('vk_user_id');
  localStorage.removeItem('vk_access_token');
  localStorage.removeItem('userId');
  localStorage.removeItem('vk_auth_completed');
  
  // КРИТИЧНО: Очищаем режим просмотра админом
  const adminViewingUserId = localStorage.getItem('admin_viewing_user_id');
  if (adminViewingUserId) {
    console.log('[SESSION_CLEANUP] Clearing admin viewing session:', adminViewingUserId);
    localStorage.removeItem('admin_viewing_user_id');
    localStorage.removeItem('admin_viewing_user');
  }
  
  console.log('[SESSION_CLEANUP] Session cleanup completed');
};

/**
 * Проверяет, валидна ли сессия просмотра админом
 * Автоматически очищает если админ потерял авторизацию
 * Возвращает false если сессия была невалидна и очищена
 */
export const isAdminViewingSessionValid = (): boolean => {
  const adminViewingUserId = localStorage.getItem('admin_viewing_user_id');
  if (!adminViewingUserId) return true; // нет режима просмотра - всё ок
  
  // Проверяем, что админ авторизован
  const authSession = localStorage.getItem('authSession');
  const vkUser = localStorage.getItem('vk_user');
  const googleUser = localStorage.getItem('google_user');
  
  if (!authSession && !vkUser && !googleUser) {
    console.warn('[SESSION_CLEANUP] Admin viewing session invalid: no auth, clearing');
    localStorage.removeItem('admin_viewing_user_id');
    localStorage.removeItem('admin_viewing_user');
    return false;
  }
  
  return true;
};