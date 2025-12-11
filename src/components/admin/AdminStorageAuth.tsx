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
    console.log('[ADMIN_STORAGE] Component mounted, checking admin rights...');
    
    const authSession = localStorage.getItem('authSession');
    const vkUser = localStorage.getItem('vk_user');
    
    console.log('[ADMIN_STORAGE] authSession:', authSession ? 'exists' : 'missing');
    console.log('[ADMIN_STORAGE] vkUser:', vkUser ? 'exists' : 'missing');
    
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
        console.log('[ADMIN_STORAGE] Extracted vkUserData:', vkUserData);
      } catch (e) {
        console.error('[ADMIN_STORAGE] Failed to parse vkUser:', e);
      }
    }
    
    const isAdmin = isAdminUser(userEmail, vkUserData);
    console.log('[ADMIN_STORAGE] isAdminUser result:', isAdmin);
    
    if (!isAdmin) {
      console.error('[ADMIN_STORAGE] Access denied - not an admin');
      toast({ 
        title: 'Ошибка доступа', 
        description: 'У вас нет прав администратора. Перенаправление на главную...', 
        variant: 'destructive' 
      });
      setTimeout(() => navigate('/'), 2000);
      return;
    }
    
    const key = 'admin123';
    onAuthSuccess(key);
    console.log('[ADMIN_STORAGE] Admin access granted, adminKey set');
  }, [onAuthSuccess, toast, navigate]);

  return null;
};