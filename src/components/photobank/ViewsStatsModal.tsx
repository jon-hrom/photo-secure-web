import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { getTimezoneForRegion, getUserTimezoneShort } from '@/utils/regionTimezone';

interface ViewsStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  folderName: string;
  userId: number;
}

interface DayStat {
  day: string;
  count: number;
}

interface DeviceStat {
  device: string;
  count: number;
}

interface RecentView {
  viewed_at: string;
  client_ip: string;
  user_agent: string;
  device_type: string;
  short_code: string;
}

interface StatsResponse {
  total_views: number;
  unique_visitors: number;
  first_view: string | null;
  last_view: string | null;
  by_day: DayStat[];
  by_device: DeviceStat[];
  recent: RecentView[];
  timezone?: string;
  region?: string;
}

const GALLERY_SHARE_URL = 'https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab';

const deviceLabel = (d: string) => {
  if (d === 'mobile') return 'Телефон';
  if (d === 'tablet') return 'Планшет';
  if (d === 'desktop') return 'Компьютер';
  return 'Неизвестно';
};

const deviceIcon = (d: string): 'Smartphone' | 'Tablet' | 'Monitor' | 'HelpCircle' => {
  if (d === 'mobile') return 'Smartphone';
  if (d === 'tablet') return 'Tablet';
  if (d === 'desktop') return 'Monitor';
  return 'HelpCircle';
};

const browserFromUA = (ua: string): string => {
  if (!ua) return '—';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/YaBrowser/i.test(ua)) return 'Яндекс.Браузер';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  return 'Браузер';
};

const formatDate = (iso: string, tz: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });
  } catch {
    return iso;
  }
};

const formatDay = (iso: string, tz: string) => {
  try {
    // iso для by_day приходит как YYYY-MM-DD (уже в TZ фотографа).
    // Если есть время — приведём к TZ. Если без времени — просто 2 части.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [, mm, dd] = iso.split('-');
      return `${dd}.${mm}`;
    }
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: tz });
  } catch {
    return iso;
  }
};

const ViewsStatsModal = ({ isOpen, onClose, folderId, folderName, userId }: ViewsStatsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [clearing, setClearing] = useState(false);

  const loadStats = () => {
    setLoading(true);
    setError(null);
    fetch(`${GALLERY_SHARE_URL}?action=views_stats&folder_id=${folderId}`, {
      headers: { 'X-User-Id': userId.toString() },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as StatsResponse;
        setStats(d);
      })
      .catch((e) => setError(e?.message || 'Не удалось загрузить статистику'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, folderId, userId]);

  const handleClearViews = async () => {
    if (!confirm('Очистить все просмотры этой галереи? Действие нельзя отменить, новые просмотры будут считаться с нуля.')) return;
    setClearing(true);
    try {
      const r = await fetch(GALLERY_SHARE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString(),
        },
        body: JSON.stringify({ action: 'clear_views', folder_id: folderId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      loadStats();
    } catch (e) {
      alert('Не удалось очистить просмотры');
      console.error(e);
    } finally {
      setClearing(false);
    }
  };

  const tz = useMemo(() => {
    if (stats?.timezone) return stats.timezone;
    const region = typeof window !== 'undefined' ? localStorage.getItem('user_region') || '' : '';
    return getTimezoneForRegion(region);
  }, [stats?.timezone]);

  const tzLabel = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const city = localStorage.getItem('user_city') || '';
    const region = localStorage.getItem('user_region') || '';
    const place = city || region || stats?.region || 'Москва';
    return `${getUserTimezoneShort()}, ${place}`;
  }, [stats?.region]);

  if (!isOpen) return null;

  const maxDayCount = Math.max(1, ...(stats?.by_day || []).map((d) => d.count));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <Icon name="Eye" size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate">Просмотры галереи</h2>
              <p className="text-xs text-muted-foreground truncate">
                {folderName}
                {tzLabel && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground/80">
                    · <Icon name="Globe" size={10} /> {tzLabel}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <Icon name="X" size={20} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-6 py-4 space-y-5" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading && (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Icon name="Loader2" size={28} className="animate-spin mb-2" />
              <p className="text-sm">Загружаем статистику…</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md p-3">
              {error}
            </div>
          )}

          {stats && !loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icon name="Eye" size={12} /> Просмотров
                  </div>
                  <div className="text-2xl font-bold text-purple-600">{stats.total_views}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icon name="Users" size={12} /> Уникальных
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{stats.unique_visitors}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icon name="Clock" size={12} /> Первый
                  </div>
                  <div className="text-sm font-medium">
                    {stats.first_view ? formatDate(stats.first_view, tz) : '—'}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icon name="Clock" size={12} /> Последний
                  </div>
                  <div className="text-sm font-medium">
                    {stats.last_view ? formatDate(stats.last_view, tz) : '—'}
                  </div>
                </div>
              </div>

              {stats.by_day.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Icon name="BarChart3" size={14} /> Просмотры по дням
                  </h3>
                  <div className="space-y-1">
                    {stats.by_day.slice(0, 14).map((d) => (
                      <div key={d.day} className="flex items-center gap-2 text-xs">
                        <span className="w-12 text-muted-foreground flex-shrink-0">{formatDay(d.day, tz)}</span>
                        <div className="flex-1 h-4 bg-muted rounded relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-purple-500 rounded"
                            style={{ width: `${(d.count / maxDayCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-medium">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.by_device.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Icon name="Smartphone" size={14} /> Устройства
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {stats.by_device.map((d) => (
                      <div
                        key={d.device}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs"
                      >
                        <Icon name={deviceIcon(d.device)} size={12} />
                        <span>{deviceLabel(d.device)}</span>
                        <span className="font-semibold">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <Icon name="List" size={14} /> Последние просмотры
                </h3>
                {stats.recent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Пока никто не открывал ссылку.</p>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <div className="md:max-h-[260px] md:overflow-y-auto overscroll-contain divide-y">
                      {stats.recent.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                          <Icon name={deviceIcon(r.device_type)} size={14} className="text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">{formatDate(r.viewed_at, tz)}</span>
                              <span className="text-muted-foreground">·</span>
                              <span>{deviceLabel(r.device_type)}</span>
                              <span className="text-muted-foreground">·</span>
                              <span>{browserFromUA(r.user_agent)}</span>
                              {r.client_ip && (
                                <>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground">IP {r.client_ip}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 border-t flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleClearViews}
            disabled={clearing || loading || !stats || stats.total_views === 0}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            {clearing ? (
              <>
                <Icon name="Loader2" size={16} className="animate-spin mr-1.5" />
                Очищаем…
              </>
            ) : (
              <>
                <Icon name="Trash2" size={16} className="mr-1.5" />
                Очистить просмотры
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </div>
  );
};

export default ViewsStatsModal;