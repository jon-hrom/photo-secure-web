import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useAdminPanelRoleManager = () => {
  const [currentRole, setCurrentRole] = useState<'admin' | 'client' | 'user_view'>('admin');
  const [viewedUser, setViewedUser] = useState<{ userId: number; userEmail: string } | null>(null);

  useEffect(() => {
    const savedViewedUser = localStorage.getItem('admin_viewing_user');
    if (savedViewedUser) {
      try {
        const parsed = JSON.parse(savedViewedUser);
        setViewedUser(parsed);
        setCurrentRole('user_view');
      } catch (e) {
        localStorage.removeItem('admin_viewing_user');
      }
    }
  }, []);

  const handleRoleChange = (role: 'admin' | 'client' | 'user_view') => {
    if (role === 'user_view') {
      toast.error('Используйте выбор пользователя ниже');
      return;
    }
    setCurrentRole(role);
    setViewedUser(null);
    toast.success(role === 'admin' ? 'Переключено на роль Администратора' : 'Переключено на роль Клиента');
  };

  const handleEnterUserView = (userId: number, userEmail: string) => {
    setViewedUser({ userId, userEmail });
    setCurrentRole('user_view');
    localStorage.setItem('admin_viewing_user', JSON.stringify({ userId, userEmail }));
  };

  const handleExitUserView = () => {
    setViewedUser(null);
    setCurrentRole('admin');
    localStorage.removeItem('admin_viewing_user');
  };

  return {
    currentRole,
    viewedUser,
    handleRoleChange,
    handleEnterUserView,
    handleExitUserView,
  };
};
