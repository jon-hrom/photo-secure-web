import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useAdminPanelUsers = () => {
  const [users, setUsers] = useState<any[]>([]);

  const loadUsers = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a');
      const data = await response.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const deleteUser = async (userId: string | number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Пользователь и все его данные удалены');
        loadUsers();
      } else {
        toast.error(data.error || 'Ошибка удаления');
      }
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      toast.error('Ошибка подключения к серверу');
    }
  };

  const blockUser = async (userId: string | number, reason: string) => {
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: 'block', reason }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Пользователь заблокирован');
        loadUsers();
      } else {
        toast.error('Ошибка блокировки');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const unblockUser = async (userId: string | number) => {
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action: 'unblock' }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Пользователь разблокирован');
        loadUsers();
      } else {
        toast.error('Ошибка разблокировки');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  useEffect(() => {
    loadUsers();
    
    const usersInterval = setInterval(() => {
      loadUsers();
    }, 30000);
    
    return () => clearInterval(usersInterval);
  }, []);

  return {
    users,
    loadUsers,
    deleteUser,
    blockUser,
    unblockUser,
  };
};
