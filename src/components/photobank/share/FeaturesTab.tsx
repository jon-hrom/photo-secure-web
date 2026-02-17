import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';

const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';

interface RegisteredClient {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  created_at: string | null;
  upload_enabled: boolean;
  is_online: boolean;
  last_seen_at: string | null;
}

interface FeaturesTabProps {
  galleryCode: string;
  userId: number;
}

export default function FeaturesTab({ galleryCode, userId }: FeaturesTabProps) {
  const [clients, setClients] = useState<RegisteredClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const isFirstLoad = useRef(true);

  const loadClients = useCallback(async (silent = false) => {
    if (!galleryCode) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          action: 'list_registered_clients',
          gallery_code: galleryCode
        })
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('[FeaturesTab] Error loading clients:', err);
    }
    if (!silent) setLoading(false);
  }, [galleryCode, userId]);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      loadClients();
    }
    const interval = setInterval(() => loadClients(true), 10000);
    return () => clearInterval(interval);
  }, [loadClients]);

  const handleToggleUpload = async (clientId: number, enabled: boolean) => {
    setToggling(clientId);
    try {
      const res = await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          action: 'toggle_upload',
          client_id: clientId,
          gallery_code: galleryCode,
          upload_enabled: enabled
        })
      });
      if (res.ok) {
        setClients(prev =>
          prev.map(c => c.id === clientId ? { ...c, upload_enabled: enabled } : c)
        );
      }
    } catch (err) {
      console.error('[FeaturesTab] Toggle error:', err);
    }
    setToggling(null);
  };

  const formatLastSeen = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 2) return 'только что';
    if (diffMin < 60) return `${diffMin} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <Icon name="Upload" size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white text-sm">Загрузка фото клиентом</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Включите загрузку напротив нужного клиента. Только он увидит кнопку «Загрузить фото».
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Icon name="Loader2" size={24} className="animate-spin text-gray-400" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 text-center">
          <Icon name="Users" size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Пока никто не зарегистрировался по этой ссылке
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Клиенты появятся здесь после того, как нажмут звёздочку в галерее
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Зарегистрированные клиенты ({clients.length})
          </p>
          {clients.map(client => (
            <div key={client.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    client.is_online
                      ? 'bg-green-100 dark:bg-green-900/40'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    <Icon
                      name="User"
                      size={16}
                      className={client.is_online ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}
                    />
                  </div>
                  {client.is_online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {client.full_name || client.phone || client.email || 'Без имени'}
                    </p>
                    {client.is_online && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                        онлайн
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {client.phone && <span>{client.phone}</span>}
                    {client.phone && client.email && <span>·</span>}
                    {client.email && <span className="truncate">{client.email}</span>}
                    {!client.is_online && client.last_seen_at && (
                      <>
                        <span>·</span>
                        <span className="text-gray-400 dark:text-gray-500">{formatLastSeen(client.last_seen_at)}</span>
                      </>
                    )}
                    {!client.is_online && !client.last_seen_at && client.created_at && (
                      <>
                        <span>·</span>
                        <span>{formatDate(client.created_at)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {client.upload_enabled && (
                  <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                    Загрузка
                  </span>
                )}
                <Switch
                  checked={client.upload_enabled}
                  onCheckedChange={(enabled) => handleToggleUpload(client.id, enabled)}
                  disabled={toggling === client.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
