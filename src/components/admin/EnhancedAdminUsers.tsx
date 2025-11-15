import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { useState, useMemo } from 'react';
import UserDetailsModal from './UserDetailsModal';

interface User {
  id: number;
  email: string;
  phone: string | null;
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
  onBlock: (userId: number, reason: string) => void;
  onUnblock: (userId: number) => void;
  onDelete: (userId: number) => void;
}

const EnhancedAdminUsers = ({ users, onBlock, onUnblock, onDelete }: EnhancedAdminUsersProps) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'email' | 'lastLogin'>('date');
  const [filterByActivity, setFilterByActivity] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredAndSortedUsers = useMemo(() => {
    const filtered = users.filter(user => {
      const matchesSearch = 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.phone && user.phone.includes(searchQuery)) ||
        (user.ip_address && user.ip_address.includes(searchQuery));
      
      const matchesActivity = 
        filterByActivity === 'all' ? true :
        filterByActivity === 'active' ? user.is_active :
        !user.is_active;
      
      return matchesSearch && matchesActivity;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'email') {
        return a.email.localeCompare(b.email);
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
  }, [users, searchQuery, sortBy, filterByActivity]);

  const activeUsers = filteredAndSortedUsers.filter(u => !u.is_blocked);
  const blockedUsers = filteredAndSortedUsers.filter(u => u.is_blocked);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openUserDetails = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const exportToCSV = () => {
    const csvHeaders = [
      'ID',
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
      user.email,
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

  const renderUserCard = (user: User) => (
    <div
      key={user.id}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => openUserDetails(user)}
    >
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon name="Mail" size={16} className="text-muted-foreground" />
          <span className="font-medium text-sm sm:text-base break-all">{user.email}</span>
          {user.is_blocked ? (
            <Badge variant="destructive" className="ml-auto sm:ml-2 gap-1">
              <Icon name="Ban" size={12} />
              Заблокирован
            </Badge>
          ) : (
            <Badge variant="default" className="ml-auto sm:ml-2 gap-1">
              <Icon name="CheckCircle" size={12} />
              Активен
            </Badge>
          )}
        </div>

        {user.phone && (
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
            <div className="flex items-center gap-1.5">
              <Icon name="Clock" size={14} />
              <span>Вход: {formatDate(user.last_login)}</span>
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Users" size={24} />
            Управление пользователями
          </CardTitle>
          <CardDescription>
            Белый и черный списки пользователей с детальной информацией
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