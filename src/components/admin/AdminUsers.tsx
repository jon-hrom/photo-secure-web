import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface User {
  id: number;
  email: string;
  phone: string | null;
  created_at: string;
  is_active: boolean;
}

interface AdminUsersProps {
  users: User[];
  onDelete: (userId: number) => void;
}

const AdminUsers = ({ users, onDelete }: AdminUsersProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Управление пользователями</CardTitle>
        <CardDescription>Просмотр и удаление зарегистрированных пользователей</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="Users" size={48} className="mx-auto mb-3 opacity-50" />
              <p>Нет зарегистрированных пользователей</p>
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon name="Mail" size={16} className="text-muted-foreground" />
                    <span className="font-medium text-sm sm:text-base break-all">{user.email}</span>
                    {user.is_active ? (
                      <Badge variant="default" className="ml-auto sm:ml-2">Активен</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-auto sm:ml-2">Неактивен</Badge>
                    )}
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon name="Phone" size={14} />
                      <span>{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Icon name="Calendar" size={14} />
                    <span>
                      Регистрация: {new Date(user.created_at).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(user.id)}
                  className="w-full sm:w-auto"
                >
                  <Icon name="Trash2" size={16} className="mr-2" />
                  Удалить
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUsers;