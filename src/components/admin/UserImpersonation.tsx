import { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface User {
  user_id: number;
  email: string;
  full_name?: string;
  avatar_url?: string;
  source?: string;
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'blocked'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'email' | 'id'>('recent');
  
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

  const filteredAndSortedUsers = useMemo(() => {
    let result = users.filter(user => user && user.user_id != null);
    
    // Remove duplicates by user_id (keep the most recent entry)
    const uniqueUsersMap = new Map<number, User>();
    result.forEach(user => {
      const existing = uniqueUsersMap.get(user.user_id);
      if (!existing || new Date(user.last_login || user.created_at).getTime() > new Date(existing.last_login || existing.created_at).getTime()) {
        uniqueUsersMap.set(user.user_id, user);
      }
    });
    result = Array.from(uniqueUsersMap.values());
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user => 
        user.email?.toLowerCase().includes(query) ||
        user.full_name?.toLowerCase().includes(query) ||
        user.user_id?.toString().includes(query)
      );
    }
    
    // Filter by status
    if (filterStatus === 'active') {
      result = result.filter(user => !user.is_blocked);
    } else if (filterStatus === 'blocked') {
      result = result.filter(user => user.is_blocked);
    }
    
    // Sort
    result.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.last_login || b.created_at).getTime() - new Date(a.last_login || a.created_at).getTime();
      } else if (sortBy === 'email') {
        return (a.email || '').localeCompare(b.email || '');
      } else if (sortBy === 'id') {
        return b.user_id - a.user_id;
      }
      return 0;
    });
    
    return result;
  }, [users, searchQuery, filterStatus, sortBy]);

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Icon name="Eye" className="text-purple-600 dark:text-purple-400" size={24} />
          Просмотр кабинетов пользователей
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isInUserView ? (
          <>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Поиск пользователя</label>
                <div className="relative">
                  <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Email, имя или ID пользователя..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Статус</label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все пользователи</SelectItem>
                      <SelectItem value="active">Активные</SelectItem>
                      <SelectItem value="blocked">Заблокированные</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Сортировка</label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">По активности</SelectItem>
                      <SelectItem value="email">По email</SelectItem>
                      <SelectItem value="id">По ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Найдено: {filteredAndSortedUsers.length}</span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Icon name="X" size={12} />
                    Сбросить поиск
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Выберите пользователя</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите пользователя из списка" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredAndSortedUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      <Icon name="Search" size={24} className="mx-auto mb-2 opacity-50" />
                      Пользователи не найдены
                    </div>
                  ) : (
                    filteredAndSortedUsers.map(user => {
                      const isSelected = selectedUserId === user.user_id.toString();
                      return (
                        <SelectItem 
                          key={user.user_id} 
                          value={user.user_id.toString()}
                          className={isSelected ? 'bg-purple-100 dark:bg-purple-900/30 border-l-4 border-purple-500' : ''}
                        >
                          <div className="flex items-center gap-3 w-full min-w-0">
                            {user.avatar_url ? (
                              <img 
                                src={user.avatar_url} 
                                alt={user.full_name || user.email || 'User'} 
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-purple-200"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0 ring-2 ring-purple-200">
                                <span className="text-white text-xs font-semibold">
                                  {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-medium truncate ${isSelected ? 'text-purple-700 dark:text-purple-300' : ''}`}>
                                  {user.full_name || user.email || 'Без email'}
                                </span>
                                {user.source === 'vk' && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">VK</Badge>
                                )}
                                {user.is_blocked && (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                    <Icon name="Ban" size={10} className="mr-1" />
                                    Заблокирован
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Icon name="Check" size={14} className="text-purple-600 flex-shrink-0" />
                                )}
                              </div>
                              {user.full_name && user.email && (
                                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                              )}
                            </div>
                            
                            <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">
                              ID: {user.user_id}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (() => {
              const selectedUser = filteredAndSortedUsers.find(u => u.user_id.toString() === selectedUserId);
              if (!selectedUser) return null;
              return (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon name="CheckCircle" size={16} className="text-purple-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-purple-900">Выбран пользователь:</span>
                  </div>
                  <div className="flex items-center gap-3 pl-6">
                    {selectedUser.avatar_url ? (
                      <img 
                        src={selectedUser.avatar_url} 
                        alt={selectedUser.full_name || selectedUser.email || 'User'} 
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-2 ring-purple-300">
                        <span className="text-white text-sm font-bold">
                          {(selectedUser.full_name || selectedUser.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-purple-900">{selectedUser.full_name || selectedUser.email || 'Без email'}</div>
                      <div className="text-xs text-purple-700 font-mono">ID: {selectedUser.user_id} • {selectedUser.email || 'Нет email'}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
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