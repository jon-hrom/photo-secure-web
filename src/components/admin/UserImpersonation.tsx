import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface User {
  user_id: number;
  email: string;
  created_at: string;
  last_login: string;
  is_blocked: boolean;
}

interface UserImpersonationProps {
  users: User[];
  onEnterUserView: (userId: number, userEmail: string) => void;
  onExitUserView: () => void;
  isInUserView: boolean;
  currentViewedUser?: { userId: number; userEmail: string };
}

const UserImpersonation = ({ 
  users, 
  onEnterUserView, 
  onExitUserView, 
  isInUserView,
  currentViewedUser 
}: UserImpersonationProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  const handleEnterView = () => {
    if (!selectedUserId) {
      toast.error('Выберите пользователя');
      return;
    }
    
    const user = users.find(u => u.user_id.toString() === selectedUserId);
    if (!user) {
      toast.error('Пользователь не найден');
      return;
    }
    
    if (user.is_blocked) {
      toast.warning('Внимание: пользователь заблокирован');
    }
    
    onEnterUserView(user.user_id, user.email);
    toast.success(`Вход в кабинет: ${user.email}`);
  };

  const handleExitView = () => {
    setSelectedUserId('');
    onExitUserView();
    toast.success('Возврат в режим администратора');
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Eye" className="text-purple-600" size={24} />
          Просмотр кабинетов пользователей
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isInUserView ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Выберите пользователя</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите пользователя из списка" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id.toString()}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="flex-1">{user.email}</span>
                        {user.is_blocked && (
                          <Badge variant="destructive" className="text-[10px]">Заблокирован</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          ID: {user.user_id}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="flex gap-2">
                <Icon name="Info" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-blue-800">
                  <p className="font-semibold mb-1">Режим просмотра кабинета</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Вы увидите все страницы и данные пользователя</li>
                    <li>• Можете переключаться между страницами</li>
                    <li>• Все изменения видны в реальном времени</li>
                    <li>• Не мешаете работе пользователя</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleEnterView} 
              className="w-full"
              disabled={!selectedUserId}
            >
              <Icon name="Eye" size={18} className="mr-2" />
              Войти в кабинет пользователя
            </Button>
          </>
        ) : (
          <>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                    <Icon name="Eye" className="text-amber-700" size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Режим просмотра активен</p>
                    <p className="text-xs text-amber-700">Вы смотрите кабинет пользователя</p>
                  </div>
                </div>
                <Badge className="bg-amber-600">Активен</Badge>
              </div>
              
              <div className="bg-white rounded-md p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="User" size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Email:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6">{currentViewedUser?.userEmail}</p>
              </div>

              <div className="bg-white rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="Hash" size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">User ID:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6">{currentViewedUser?.userId}</p>
              </div>
            </div>

            <Button 
              onClick={handleExitView} 
              variant="outline"
              className="w-full border-2"
            >
              <Icon name="X" size={18} className="mr-2" />
              Выйти из кабинета пользователя
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default UserImpersonation;
