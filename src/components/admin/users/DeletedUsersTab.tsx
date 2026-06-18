import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';

const DELETE_USER_URL = 'https://functions.poehali.dev/9df9d28d-b7ea-448c-9d93-054c04b6a52b';

interface DeletedUser {
  id: number;
  user_id: number;
  email: string | null;
  phone: string | null;
  source: string | null;
  registered_at: string | null;
  removed_at: string;
  removed_by: string;
  photos_count: number;
  storage_freed_bytes: number;
  ip_address: string | null;
  reason: string | null;
}

interface DeletedStats {
  total: number;
  photos: number;
  storage_freed_bytes: number;
  last_30d: number;
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 МБ';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} ГБ`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} МБ`;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
};

const DeletedUsersTab = () => {
  const [items, setItems] = useState<DeletedUser[]>([]);
  const [stats, setStats] = useState<DeletedStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(DELETE_USER_URL, { method: 'GET' });
      const data = await res.json();
      if (data.success) {
        setItems(data.deleted_users || []);
        setStats(data.stats || null);
      }
    } catch (e) {
      console.error('Failed to load deleted users:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Icon name="Loader" size={32} className="mx-auto mb-3 animate-spin" />
        <p>Загрузка статистики...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Всего удалено</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">За 30 дней</p>
            <p className="text-2xl font-bold">{stats.last_30d}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Удалено фото</p>
            <p className="text-2xl font-bold">{stats.photos}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Освобождено места</p>
            <p className="text-2xl font-bold">{formatBytes(stats.storage_freed_bytes)}</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="UserX" size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">Удалённых аккаунтов пока нет</p>
          <p className="text-sm mt-1">Здесь появится статистика по удалённым пользователям</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((u) => (
            <div key={u.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <Icon name="Mail" size={16} className="text-muted-foreground" />
                  <span>{u.email || u.phone || `ID ${u.user_id}`}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {u.source || 'email'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    {u.removed_by === 'admin' ? 'Удалён админом' : 'Удалил сам'}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Icon name="Calendar" size={14} /> Удалён: {formatDate(u.removed_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="Image" size={14} /> Фото: {u.photos_count}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="HardDrive" size={14} /> {formatBytes(u.storage_freed_bytes)}
                </span>
                {u.ip_address && (
                  <span className="flex items-center gap-1">
                    <Icon name="Globe" size={14} /> {u.ip_address}
                  </span>
                )}
              </div>
              {u.reason && (
                <div className="mt-2 rounded-lg bg-muted/60 p-2 text-sm flex items-start gap-2">
                  <Icon name="MessageSquare" size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                  <span className="italic">«{u.reason}»</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeletedUsersTab;