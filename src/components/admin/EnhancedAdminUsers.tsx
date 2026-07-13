import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useState, useMemo, useEffect } from 'react';
import UserDetailsModal from './UserDetailsModal';
import AdminUserPhotoBank from './AdminUserPhotoBank';
import UserCard from './users/UserCard';
import UsersToolbar from './users/UsersToolbar';
import DeletedUsersTab from './users/DeletedUsersTab';
import type { User, EnhancedAdminUsersProps } from './users/types';
import { isOnline } from './users/types';

const EnhancedAdminUsers = ({ users, onBlock, onUnblock, onDelete, onRefresh, onOpenPhotoBank }: EnhancedAdminUsersProps) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'email' | 'lastLogin'>('date');
  const [filterByActivity, setFilterByActivity] = useState<'all' | 'online' | 'active' | 'inactive'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [photoBankUser, setPhotoBankUser] = useState<User | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      if (onRefresh) {
        onRefresh();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [onRefresh]);

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
        filterByActivity === 'online' ? isOnline(user) :
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
  
  const onlineCount = activeUsers.filter(u => isOnline(u)).length;
  const offlineCount = activeUsers.filter(u => !isOnline(u)).length;

  const openUserDetails = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
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
          <UsersToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterByActivity={filterByActivity}
            onFilterChange={setFilterByActivity}
            filteredCount={filteredAndSortedUsers.length}
            totalCount={users.length}
            filteredUsers={filteredAndSortedUsers}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onSetRefreshing={setIsRefreshing}
          />

          <Tabs defaultValue="whitelist" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
              <TabsTrigger value="whitelist" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 px-1 sm:px-3 text-xs sm:text-sm whitespace-normal text-center leading-tight">
                <Icon name="CheckCircle" size={16} className="shrink-0" />
                <span>
                  <span className="hidden sm:inline">Белый список</span>
                  <span className="sm:hidden">Белый</span> ({activeUsers.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="blacklist" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 px-1 sm:px-3 text-xs sm:text-sm whitespace-normal text-center leading-tight">
                <Icon name="Ban" size={16} className="shrink-0" />
                <span>
                  <span className="hidden sm:inline">Черный список</span>
                  <span className="sm:hidden">Черный</span> ({blockedUsers.length})
                </span>
              </TabsTrigger>
              <TabsTrigger value="deleted" className="flex-col sm:flex-row gap-1 sm:gap-2 py-2 px-1 sm:px-3 text-xs sm:text-sm whitespace-normal text-center leading-tight">
                <Icon name="UserX" size={16} className="shrink-0" />
                <span>Удалённые</span>
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
                activeUsers.map(user => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onOpenDetails={openUserDetails}
                    onOpenPhotoBank={setPhotoBankUser}
                  />
                ))
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
                blockedUsers.map(user => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onOpenDetails={openUserDetails}
                    onOpenPhotoBank={setPhotoBankUser}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="deleted" className="mt-4">
              <DeletedUsersTab />
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
        onOpenPhotoBank={(userId) => {
          setIsModalOpen(false);
          const user = users.find(u => u.id === userId);
          if (user) setPhotoBankUser(user);
          if (onOpenPhotoBank) onOpenPhotoBank(userId);
        }}
      />

      {photoBankUser && (
        <AdminUserPhotoBank
          userId={photoBankUser.id}
          userName={photoBankUser.full_name || photoBankUser.email || photoBankUser.phone || String(photoBankUser.id)}
          isOpen={!!photoBankUser}
          onClose={() => setPhotoBankUser(null)}
        />
      )}
    </>
  );
};

export default EnhancedAdminUsers;