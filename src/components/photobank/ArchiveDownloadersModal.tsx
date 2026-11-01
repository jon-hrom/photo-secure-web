import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { getTimezoneForRegion, getUserTimezoneShort } from '@/utils/regionTimezone';

interface ArchiveDownloadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  folderName: string;
  userId: number;
}

interface DownloaderItem {
  id: number;
  downloaded_at: string | null;
  ip: string | null;
  user_agent: string | null;
  client_id: number | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

const DOWNLOAD_ZIP_URL = 'https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a';

const deviceFromUA = (ua?: string | null) => {
  if (!ua) return '';
  if (/iPad|Tablet/i.test(ua)) return 'Планшет';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'Телефон';
  return 'Компьютер';
};

const isGuestName = (name?: string | null) => !name || /^Гость\s/i.test(name);

const ArchiveDownloadersModal = ({ isOpen, onClose, folderId, folderName, userId }: ArchiveDownloadersModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DownloaderItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetch(`${DOWNLOAD_ZIP_URL}?action=downloaders&folderId=${folderId}`, {
      headers: { 'X-User-Id': userId.toString() },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        setItems(d.items || []);
      })
      .catch(() => setError('Не удалось загрузить список'))
      .finally(() => setLoading(false));
  }, [isOpen, folderId, userId]);

  const tz = useMemo(() => {
    const region = typeof window !== 'undefined' ? localStorage.getItem('user_region') || '' : '';
    return getTimezoneForRegion(region);
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz,
      });
    } catch {
      return iso;
    }
  };

  if (!isOpen) return null;

  const knownCount = items.filter((i) => i.client_id && !isGuestName(i.full_name)).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <Icon name="Download" size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate">Кто скачал архив</h2>
              <p className="text-xs text-muted-foreground truncate">
                {folderName} · время: {getUserTimezoneShort()}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <Icon name="X" size={18} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3">
          {loading && (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Icon name="Loader2" size={28} className="animate-spin mb-2" />
              <p className="text-sm">Загружаем список…</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md p-3">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Icon name="DownloadCloud" size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Архив этой папки ещё никто не скачивал</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Всего скачиваний</div>
                  <div className="text-2xl font-bold text-emerald-600">{items.length}</div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">От известных клиентов</div>
                  <div className="text-2xl font-bold text-foreground">{knownCount}</div>
                </div>
              </div>

              <div className="space-y-2">
                {items.map((it) => {
                  const known = it.client_id && !isGuestName(it.full_name);
                  const device = deviceFromUA(it.user_agent);
                  return (
                    <div key={it.id} className="rounded-lg border bg-card p-3 flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${known ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                        <Icon name={known ? 'UserCheck' : 'User'} size={16} className={known ? 'text-emerald-600' : 'text-muted-foreground'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <p className="font-medium text-sm break-words">
                            {known ? it.full_name : 'Без регистрации'}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(it.downloaded_at)}</span>
                        </div>
                        {known && (
                          <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-0.5 text-xs">
                            {it.phone && (
                              <a href={`tel:${it.phone}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                <Icon name="Phone" size={12} />
                                {it.phone}
                              </a>
                            )}
                            {it.email && (
                              <a href={`mailto:${it.email}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all">
                                <Icon name="Mail" size={12} />
                                {it.email}
                              </a>
                            )}
                          </div>
                        )}
                        {device && <p className="mt-1 text-[11px] text-muted-foreground">{device}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchiveDownloadersModal;
