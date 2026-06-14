import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/icon';
import {
  Ticket, adminFetchTickets, adminFetchUnread, formatTicketTime,
  STATUS_LABELS, PRIORITY_LABELS, REQUEST_TYPE_LABELS,
} from './supportTicketsApi';
import TicketDetail from './TicketDetail';

interface AdminTicketsButtonProps {
  userId: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUnreadChange?: (count: number) => void;
  hideFab?: boolean;
}

type Filter = 'open' | 'closed' | 'all';

const statusBadgeClass = (status: string) => {
  if (status === 'closed') return 'bg-muted text-muted-foreground';
  if (status === 'in_progress') return 'bg-orange-500/15 text-orange-500';
  return 'bg-blue-500/15 text-blue-500';
};

const priorityDot = (priority: string) => {
  if (priority === 'urgent') return 'text-red-500';
  if (priority === 'high') return 'text-orange-500';
  if (priority === 'low') return 'text-green-500';
  return 'text-blue-500';
};

const POLL_INTERVAL = 20000;

export default function AdminTicketsButton({ userId, open: openProp, onOpenChange, onUnreadChange, hideFab }: AdminTicketsButtonProps) {
  const [openState, setOpenState] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenState(v);
    onOpenChange?.(v);
  };
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [search, setSearch] = useState('');
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const prevUnread = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await adminFetchTickets(userId, status);
      setTickets(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId, filter]);

  const hasLoadedOnce = useRef(false);

  const playNotificationSound = () => {
    try {
      const soundUrl = localStorage.getItem('admin_notification_sound')
        || 'data:audio/wav;base64,UklGRmQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAEAACAP4CAf4B/gICAgH+AgIB/gH+AgICAgICAf4CAgH+Af4CAgICAgICAgH+AgICAgH+Af4B/gICAgICAf4CAgICAf4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgA==';
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  };

  const loadUnread = useCallback(async () => {
    try {
      const cnt = await adminFetchUnread(userId);
      if (hasLoadedOnce.current && cnt > prevUnread.current) {
        playNotificationSound();
      }
      hasLoadedOnce.current = true;
      setUnread(cnt);
      prevUnread.current = cnt;
      onUnreadChange?.(cnt);
    } catch {
      // ignore
    }
  }, [userId, onUnreadChange]);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadUnread]);

  useEffect(() => {
    if (open && activeTicketId === null) load();
  }, [open, load, activeTicketId]);

  const filtered = tickets.filter(t =>
    !search.trim() ||
    t.subject.toLowerCase().includes(search.toLowerCase().trim()) ||
    t.ticket_number.toLowerCase().includes(search.toLowerCase().trim()) ||
    (t.user_name || '').toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <>
      {!hideFab && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          title="Обращения в поддержку"
        >
          <Icon name="LifeBuoy" size={24} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex" onClick={() => setOpen(false)}>
          <div
            className="bg-background w-full h-full md:m-4 md:rounded-xl shadow-2xl flex flex-col overflow-hidden md:max-w-5xl md:mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {activeTicketId !== null ? (
              <TicketDetail
                userId={userId}
                ticketId={activeTicketId}
                mode="admin"
                onBack={() => { setActiveTicketId(null); load(); loadUnread(); }}
                onTicketUpdated={() => { load(); loadUnread(); }}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 p-4 border-b">
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <Icon name="LifeBuoy" size={22} className="text-primary" />
                    Обращения в поддержку
                  </h2>
                  <button className="p-2 rounded-lg hover:bg-muted" onClick={() => setOpen(false)}>
                    <Icon name="X" size={20} />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 p-4 border-b">
                  <div className="relative flex-1">
                    <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      placeholder="Поиск: тема, номер, имя..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 h-10 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex gap-1 rounded-lg border p-1">
                    {(['open', 'closed', 'all'] as Filter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 h-8 rounded-md text-sm font-medium transition-colors ${
                          filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                      >
                        {f === 'open' ? 'Открытые' : f === 'closed' ? 'Закрытые' : 'Все'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-40">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
                      <Icon name="Inbox" size={32} className="opacity-40" />
                      <p>{search ? 'Ничего не найдено' : 'Обращений нет'}</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filtered.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTicketId(t.id)}
                          className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-start gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(t.status)}`}>
                                {STATUS_LABELS[t.status]}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Icon name="Circle" size={9} className={priorityDot(t.priority)} />
                                {PRIORITY_LABELS[t.priority]}
                              </span>
                              <span className="text-xs text-muted-foreground">· {REQUEST_TYPE_LABELS[t.request_type]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{t.subject}</p>
                              {t.admin_unread_count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                  {t.admin_unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{t.last_message_preview}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.user_name || 'Пользователь'} {t.user_email ? `· ${t.user_email}` : ''}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {formatTicketTime(t.last_message_at)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}