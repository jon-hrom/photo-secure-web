import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface UserDetailsInfoProps {
  user: {
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
  };
  geoData: {country: string; city: string; flag: string} | null;
  loadingGeo: boolean;
  formatDate: (dateStr: string | null) => string;
}

const UserDetailsInfo = ({ user, geoData, loadingGeo, formatDate }: UserDetailsInfoProps) => {
  return (
    <div className="space-y-6">
      {user.avatar_url && (
        <div className="flex items-center gap-4">
          <img 
            src={user.avatar_url} 
            alt={user.full_name || 'User avatar'} 
            className="w-20 h-20 rounded-full object-cover border-4 border-primary/20"
          />
          <div>
            {user.full_name && (
              <h3 className="text-xl font-semibold">{user.full_name}</h3>
            )}
            <Badge variant="outline" className="mt-1">
              {user.source === 'vk' && 'VK ID'}
              {user.source === 'email' && 'Email'}
              {user.source === 'google' && 'Google'}
              {user.source === 'yandex' && 'Яндекс'}
            </Badge>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {user.is_blocked ? (
          <Badge variant="destructive" className="gap-1">
            <Icon name="Ban" size={14} />
            Заблокирован
          </Badge>
        ) : (
          <Badge variant="default" className="gap-1">
            <Icon name="CheckCircle" size={14} />
            Активен
          </Badge>
        )}
        {user.is_active && (
          <Badge variant="outline">Подтвержден</Badge>
        )}
        <Badge variant="outline">
          Источник: {user.source === 'vk' ? 'VK ID' : user.source === 'email' ? 'Email' : user.source}
        </Badge>
      </div>

      <div className="grid gap-4">
        {user.full_name && (
          <div className="border-l-4 border-purple-500 pl-4 py-2 bg-muted/30 rounded-r">
            <div className="text-sm text-muted-foreground mb-1">Имя</div>
            <div className="font-medium flex items-center gap-2">
              <Icon name="User" size={16} className="text-purple-500" />
              {user.full_name}
            </div>
          </div>
        )}

        {user.email && (
          <div className="border-l-4 border-primary pl-4 py-2 bg-muted/30 rounded-r">
            <div className="text-sm text-muted-foreground mb-1">Email</div>
            <div className="font-medium flex items-center gap-2">
              <Icon name="Mail" size={16} className="text-primary" />
              {user.email}
            </div>
          </div>
        )}

        {user.phone && (
          <div className="border-l-4 border-blue-500 pl-4 py-2 bg-muted/30 rounded-r">
            <div className="text-sm text-muted-foreground mb-1">Телефон</div>
            <div className="font-medium flex items-center gap-2">
              <Icon name="Phone" size={16} className="text-blue-500" />
              {user.phone}
            </div>
          </div>
        )}

        <div className="border-l-4 border-green-500 pl-4 py-2 bg-muted/30 rounded-r">
          <div className="text-sm text-muted-foreground mb-1">IP адрес и геолокация</div>
          <div className="space-y-1">
            <div className="font-medium flex items-center gap-2">
              <Icon name="Globe" size={16} className="text-green-500" />
              {user.ip_address || 'Не указан'}
            </div>
            {loadingGeo && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon name="Loader2" size={12} className="animate-spin" />
                Определение местоположения...
              </div>
            )}
            {!loadingGeo && geoData && (
              <div className="flex items-center gap-2 text-sm">
                {geoData.flag && <img src={geoData.flag} alt={geoData.country} className="w-6 h-4" />}
                <span className="text-muted-foreground">
                  {geoData.city}, {geoData.country}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="border-l-4 border-orange-500 pl-4 py-2 bg-muted/30 rounded-r">
          <div className="text-sm text-muted-foreground mb-1">Дата регистрации</div>
          <div className="font-medium flex items-center gap-2">
            <Icon name="Calendar" size={16} className="text-orange-500" />
            {formatDate(user.registered_at || user.created_at)}
          </div>
        </div>

        {user.last_login && (
          <div className="border-l-4 border-purple-500 pl-4 py-2 bg-muted/30 rounded-r">
            <div className="text-sm text-muted-foreground mb-1">Последний вход</div>
            <div className="font-medium flex items-center gap-2">
              <Icon name="Clock" size={16} className="text-purple-500" />
              {formatDate(user.last_login)}
            </div>
          </div>
        )}

        {user.user_agent && (
          <div className="border-l-4 border-cyan-500 pl-4 py-2 bg-muted/30 rounded-r">
            <div className="text-sm text-muted-foreground mb-1">Устройство / Браузер</div>
            <div className="font-medium text-sm flex items-center gap-2">
              <Icon name="Monitor" size={16} className="text-cyan-500" />
              <span className="break-all">{user.user_agent}</span>
            </div>
          </div>
        )}

        {user.is_blocked && user.blocked_reason && (
          <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 dark:bg-red-950/20 rounded-r">
            <div className="text-sm text-red-600 dark:text-red-400 mb-1">Причина блокировки</div>
            <div className="font-medium text-red-700 dark:text-red-300 flex items-start gap-2">
              <Icon name="AlertTriangle" size={16} className="mt-0.5" />
              <span>{user.blocked_reason}</span>
            </div>
            {user.blocked_at && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                Заблокирован: {formatDate(user.blocked_at)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailsInfo;
