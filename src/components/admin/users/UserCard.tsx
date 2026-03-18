import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { formatPhoneNumber } from '@/utils/phoneFormat';
import type { User } from './types';
import { isUserOnline, formatDate, getRelativeTime, getSourceLabel } from './types';

interface UserCardProps {
  user: User;
  onOpenDetails: (user: User) => void;
  onOpenPhotoBank: (user: User) => void;
}

const sourceColors: Record<string, string> = {
  'email': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'vk': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'google': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  'yandex': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
};

const UserCard = ({ user, onOpenDetails, onOpenPhotoBank }: UserCardProps) => {
  return (
    <div
      key={user.id}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onOpenDetails(user)}
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
              <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <Icon name="Mail" size={12} />
                <span className="break-all">{user.email}</span>
              </div>
            )}
            {!user.email && !user.full_name && user.phone && (
              <span className="font-medium text-sm sm:text-base">{formatPhoneNumber(user.phone)}</span>
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
            <span>{formatPhoneNumber(user.phone)}</span>
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

      <div className="flex gap-2 w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 sm:flex-none gap-2 border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPhotoBank(user);
          }}
        >
          <Icon name="Images" size={16} />
          Папки
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 sm:flex-none gap-2"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(user);
          }}
        >
          <Icon name="Eye" size={16} />
          Подробнее
        </Button>
      </div>
    </div>
  );
};

export default UserCard;
