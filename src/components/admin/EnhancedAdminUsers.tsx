import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { useState, useMemo, useEffect } from 'react';
import UserDetailsModal from './UserDetailsModal';

interface User {
  id: string | number;
  source: 'email' | 'vk' | 'google' | 'yandex';
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
  is_blocked: boolean;
  ip_address: string | null;
  last_login: string | null;
  user_agent: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  registered_at: string | null;
}

interface EnhancedAdminUsersProps {
  users: User[];
  onBlock: (userId: string | number, reason: string) => void;
  onUnblock: (userId: string | number) => void;
  onDelete: (userId: string | number) => void;
  onRefresh?: () => void;
}

const EnhancedAdminUsers = ({ users, onBlock, onUnblock, onDelete, onRefresh }: EnhancedAdminUsersProps) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'email' | 'lastLogin'>('date');
  const [filterByActivity, setFilterByActivity] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      if (onRefresh) {
        onRefresh();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  const isUserOnline = (lastLogin: string | null): boolean => {
    if (!lastLogin) return false;
    const lastLoginDate = new Date(lastLogin);
    const now = new Date();
    const diffInMinutes = (now.getTime() - lastLoginDate.getTime()) / 1000 / 60;
    return diffInMinutes < 5;
  };

  const filteredAndSortedUsers = useMemo(() => {
    if (!users || users.length === 0) return [];
    
    const filtered = users.filter(user => {
      const matchesSearch = 
        (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.phone && user.phone.includes(searchQuery)) ||
        (user.ip_address && user.ip_address.includes(searchQuery)) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesActivity = 
        filterByActivity === 'all' ? true :
        filterByActivity === 'active' ? user.is_active :
        !user.is_active;
      
      return matchesSearch && matchesActivity;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'email') {
        const aEmail = a.email || a.full_name || '';
        const bEmail = b.email || b.full_name || '';
        return aEmail.localeCompare(bEmail);
      } else if (sortBy === 'lastLogin') {
        const aDate = a.last_login ? new Date(a.last_login).getTime() : 0;
        const bDate = b.last_login ? new Date(b.last_login).getTime() : 0;
        return bDate - aDate;
      } else {
        const aDate = new Date(a.registered_at || a.created_at).getTime();
        const bDate = new Date(b.registered_at || b.created_at).getTime();
        return bDate - aDate;
      }
    });

    return filtered;
  }, [users, searchQuery, sortBy, filterByActivity, currentTime]);

  const activeUsers = filteredAndSortedUsers.filter(u => !u.is_blocked);
  const blockedUsers = filteredAndSortedUsers.filter(u => u.is_blocked);
  
  const onlineCount = activeUsers.filter(u => isUserOnline(u.last_login)).length;
  const offlineCount = activeUsers.filter(u => !isUserOnline(u.last_login)).length;

  const formatDate = (dateStr: string) => {
    const samaraTime = new Date(dateStr).toLocaleString('ru-RU', {
      timeZone: 'Europe/Samara',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${samaraTime} (UTC+4)`;
  };

  const getRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Никогда';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Только что';
    if (diffInSeconds < 300) return `${Math.floor(diffInSeconds / 60)} мин. назад`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин. назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч. назад`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} дн. назад`;
    
    return formatDate(dateStr);
  };

  const openUserDetails = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'email': 'Email',
      'vk': 'VK ID',
      'google': 'Google',
      'yandex': 'Яндекс'
    };
    return labels[source] || source;
  };

  const exportToCSV = () => {
    const csvHeaders = [
      'ID',
      'Источник',
      'Имя',
      'Email',
      'Телефон',
      'Статус',
      'Заблокирован',
      'IP адрес',
      'Дата регистрации',
      'Последний вход',
      'Браузер/Устройство',
      'Причина блокировки'
    ].join(',');

    const csvRows = filteredAndSortedUsers.map(user => [
      user.id,
      getSourceLabel(user.source),
      user.full_name || '',
      user.email || '',
      user.phone || '',
      user.is_active ? 'Активен' : 'Неактивен',
      user.is_blocked ? 'Да' : 'Нет',
      user.ip_address || '',
      user.registered_at || user.created_at,
      user.last_login || '',
      user.user_agent || '',
      user.blocked_reason || ''
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderUserCard = (user: User) => {
    const sourceColors: Record<string, string> = {
      'email': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      'vk': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
      'google': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
      'yandex': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
    };

    const isOnline = isUserOnline(user.last_login);

    return (
      <div
        key={user.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => openUserDetails(user)}
      >
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {user.avatar_url && (
              <img 
                src={user.avatar_url} 
                alt={user.full_name || 'User'} 
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            
            <div className="flex flex-col">
              {user.full_name && (
                <span className="font-medium text-sm sm:text-base">{user.full_name}</span>
              )}
              {user.email && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                  <Icon name="Mail" size={12} />
                  <span className="break-all">{user.email}</span>
                </div>
              )}
              {!user.email && !user.full_name && user.phone && (
                <span className="font-medium text-sm sm:text-base">{user.phone}</span>
              )}
            </div>

            <Badge variant="outline" className={`ml-2 text-xs ${sourceColors[user.source] || ''}`}>
              {getSourceLabel(user.source)}
            </Badge>

            <div className="flex items-center gap-2 ml-auto">
              {user.is_blocked ? (
                <Badge variant="destructive" className="gap-1">
                  <Icon name="Ban" size={12} />
                  Заблокирован
                </Badge>
              ) : user.is_active ? (
                <>
                  <Badge variant="default" className="gap-1 bg-purple-600 hover:bg-purple-700">
                    <Icon name="CheckCircle" size={12} />
                    Активен
                  </Badge>
                  {isUserOnline(user.last_login) && (
                    <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      Онлайн
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="destructive" className="gap-1 bg-red-600 hover:bg-red-700">
                  <Icon name="XCircle" size={12} />
                  Не активен
                </Badge>
              )}
            </div>
          </div>

          {user.phone && user.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Phone" size={14} />
              <span>{user.phone}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Icon name="Calendar" size={14} />
              <span>{formatDate(user.registered_at || user.created_at)}</span>
            </div>
            {user.last_login && (
              <div className="flex items-center gap-1.5" title={formatDate(user.last_login)}>
                <Icon name="Clock" size={14} />
                <span>Вход: {getRelativeTime(user.last_login)}</span>
              </div>
            )}
            {user.ip_address && (
              <div className="flex items-center gap-1.5">
                <Icon name="Globe" size={14} />
                <span>{user.ip_address}</span>
              </div>
            )}
          </div>

          {user.is_blocked && user.blocked_reason && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded">
              <Icon name="AlertTriangle" size={12} className="mt-0.5" />
              <span>{user.blocked_reason}</span>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto gap-2"
          onClick={(e) => {
            e.stopPropagation();
            openUserDetails(user);
          }}
        >
          <Icon name="Eye" size={16} />
          Подробнее
        </Button>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Users" size={24} />
            Управление пользователями
          </CardTitle>
          <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
            <span>Белый и черный списки пользователей с детальной информацией</span>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                <span className="font-medium">Онлайн: {onlineCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-600"></div>
                <span className="font-medium">Офлайн: {offlineCount}</span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Поиск по email, телефону или IP адресу..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">По дате регистрации</SelectItem>
                  <SelectItem value="email">По email</SelectItem>
                  <SelectItem value="lastLogin">По последнему входу</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterByActivity} onValueChange={(value: any) => setFilterByActivity(value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Активность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="inactive">Неактивные</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3">
              {searchQuery ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Info" size={16} />
                  <span>Найдено: {filteredAndSortedUsers.length} из {users.length}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="h-7 gap-1"
                  >
                    <Icon name="X" size={14} />
                    Сбросить
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Всего пользователей: {users.length}
                </div>
              )}

              <div className="flex items-center gap-2">
                {onRefresh && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setIsRefreshing(true);
                      await onRefresh();
                      setTimeout(() => setIsRefreshing(false), 500);
                    }}
                    disabled={isRefreshing}
                    className="gap-2"
                  >
                    <Icon name="RefreshCw" size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    {isRefreshing ? 'Обновление...' : 'Обновить'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="gap-2"
                  disabled={filteredAndSortedUsers.length === 0}
                >
                  <Icon name="Download" size={16} />
                  Экспорт в CSV
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue="whitelist" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="whitelist" className="gap-2">
                <Icon name="CheckCircle" size={16} />
                Белый список ({activeUsers.length})
              </TabsTrigger>
              <TabsTrigger value="blacklist" className="gap-2">
                <Icon name="Ban" size={16} />
                Черный список ({blockedUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="whitelist" className="space-y-3 mt-4">
              {activeUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Icon name="Users" size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Нет активных пользователей</p>
                  <p className="text-sm mt-1">Пользователи появятся здесь после регистрации</p>
                </div>
              ) : (
                activeUsers.map(renderUserCard)
              )}
            </TabsContent>

            <TabsContent value="blacklist" className="space-y-3 mt-4">
              {blockedUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Icon name="Shield" size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Черный список пуст</p>
                  <p className="text-sm mt-1">Заблокированные пользователи появятся здесь</p>
                </div>
              ) : (
                blockedUsers.map(renderUserCard)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <UserDetailsModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }}
        onBlock={onBlock}
        onUnblock={onUnblock}
        onDelete={onDelete}
      />
    </>
  );
};

export default EnhancedAdminUsers;