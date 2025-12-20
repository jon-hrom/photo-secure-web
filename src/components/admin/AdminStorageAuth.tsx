import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { isAdminUser } from '@/utils/adminCheck';

interface AdminStorageAuthProps {
  onAuthSuccess: (adminKey: string) => void;
}

export const AdminStorageAuth = ({ onAuthSuccess }: AdminStorageAuthProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[ADMIN_STORAGE] =====================================');
    console.log('[ADMIN_STORAGE] Component mounted, checking admin rights...');
    console.log('[ADMIN_STORAGE] Expected admin email: jonhrom2012@gmail.com');
    console.log('[ADMIN_STORAGE] Expected admin VK ID: 74713477');
    console.log('[ADMIN_STORAGE] Expected admin name: Евгений Пономарёв');
    
    const authSession = localStorage.getItem('authSession');
    const vkUser = localStorage.getItem('vk_user');
    
    console.log('[ADMIN_STORAGE] authSession:', authSession ? 'exists' : 'missing');
    console.log('[ADMIN_STORAGE] vkUser:', vkUser ? 'exists' : 'missing');
    
    if (authSession) {
      console.log('[ADMIN_STORAGE] authSession RAW:', authSession);
    }
    if (vkUser) {
      console.log('[ADMIN_STORAGE] vkUser RAW:', vkUser);
    }
    
    let userEmail = null;
    let vkUserData = null;
    
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        userEmail = session.userEmail;
        console.log('[ADMIN_STORAGE] Extracted userEmail:', userEmail);
      } catch (e) {
        console.error('[ADMIN_STORAGE] Failed to parse authSession:', e);
      }
    }
    
    if (vkUser) {
      try {
        vkUserData = JSON.parse(vkUser);
        console.log('[ADMIN_STORAGE] Extracted vkUserData:', JSON.stringify(vkUserData, null, 2));
        console.log('[ADMIN_STORAGE] VK ID from vkUserData:', vkUserData?.vk_id);
        console.log('[ADMIN_STORAGE] Name from vkUserData:', vkUserData?.name);
      } catch (e) {
        console.error('[ADMIN_STORAGE] Failed to parse vkUser:', e);
      }
    }
    
    const isAdmin = isAdminUser(userEmail, vkUserData);
    console.log('[ADMIN_STORAGE] isAdminUser result:', isAdmin);
    console.log('[ADMIN_STORAGE] =====================================');
    
    if (!isAdmin) {
      console.error('[ADMIN_STORAGE] ❌ Access denied - not an admin');
      console.error('[ADMIN_STORAGE] Please login via VK with account: Евгений Пономарёв (VK ID: 74713477)');
      console.error('[ADMIN_STORAGE] Or via email: jonhrom2012@gmail.com');
      toast({ 
        title: 'Ошибка доступа', 
        description: 'У вас нет прав администратора. Войдите через VK как Евгений Пономарёв или через email jonhrom2012@gmail.com', 
        variant: 'destructive' 
      });
      setTimeout(() => navigate('/'), 3000);
      return;
    }
    
    const key = 'admin123';
    onAuthSuccess(key);
    console.log('[ADMIN_STORAGE] ✅ Admin access granted, adminKey set');
  }, [onAuthSuccess, toast, navigate]);

  return null;
};