import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface UserVerification {
  id: number;
  display_name: string;
  email: string;
  phone_number: string | null;
  telegram_verified: boolean;
  telegram_verified_at: string | null;
  source: string;
  created_at: string;
}

const TelegramVerificationAdmin: React.FC = () => {
  const [users, setUsers] = useState<UserVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a?action=list');
      const data = await response.json();
      
      if (data.users) {
        setUsers(data.users);
        
        const total = data.users.length;
        const verified = data.users.filter((u: UserVerification) => u.telegram_verified).length;
        const pending = total - verified;
        
        setStats({ total, verified, pending });
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const removeVerification = async (userId: number) => {
    if (!confirm('Удалить привязку Telegram для этого пользователя?')) return;
    
    try {
      const response = await fetch('https://functions.poehali.dev/349714d2-fe2e-4f42-88fe-367b6a31396a?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          updates: {
            telegram_verified: false,
            telegram_verified_at: null,
            telegram_chat_id: null,
            phone_number: null
          }
        })
      });
      
      if (response.ok) {
        toast.success('Привязка удалена');
        loadUsers();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Всего пользователей</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Привязали Telegram</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.verified}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Не привязали</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Пользователи и верификация</CardTitle>
              <CardDescription>Управление привязкой Telegram</CardDescription>
            </div>
            <Button onClick={loadUsers} variant="outline" size="sm">
              <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Пользователь</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Телефон</th>
                  <th className="text-left p-3 font-medium">Источник</th>
                  <th className="text-center p-3 font-medium">Статус</th>
                  <th className="text-left p-3 font-medium">Дата привязки</th>
                  <th className="text-center p-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-3">{user.display_name || 'Без имени'}</td>
                    <td className="p-3 text-sm text-gray-600">{user.email || '-'}</td>
                    <td className="p-3 text-sm">{user.phone_number || '-'}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {user.source || 'email'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {user.telegram_verified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <Icon name="CheckCircle2" className="w-3 h-3" />
                          Привязан
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          <Icon name="AlertCircle" className="w-3 h-3" />
                          Не привязан
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-sm">{formatDate(user.telegram_verified_at)}</td>
                    <td className="p-3 text-center">
                      {user.telegram_verified && (
                        <Button
                          onClick={() => removeVerification(user.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Icon name="Trash2" className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramVerificationAdmin;
