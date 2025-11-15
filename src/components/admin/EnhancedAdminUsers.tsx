import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useState } from 'react';
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

  const activeUsers = users.filter(u => !u.is_blocked);
  const blockedUsers = users.filter(u => u.is_blocked);

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
