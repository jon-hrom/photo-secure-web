import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import {
  Ticket, fetchTickets, formatTicketTime,
  STATUS_LABELS, PRIORITY_LABELS, REQUEST_TYPE_LABELS,
} from './supportTicketsApi';
import CreateTicketDialog from './CreateTicketDialog';
import TicketDetail from './TicketDetail';

interface SupportTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userName?: string;
  userEmail?: string;
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

export default function SupportTicketsModal({ isOpen, onClose, userId, userName, userEmail }: SupportTicketsModalProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [creating, setCreating] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await fetchTickets(userId, status);
      setTickets(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId, filter]);

  useEffect(() => {
    if (isOpen && activeTicketId === null) load();
  }, [isOpen, load, activeTicketId]);

  if (!isOpen) return null;

  const filtered = tickets.filter(t =>
    !search.trim() || t.subject.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex" onClick={onClose}>
      <div
        className="bg-background w-full h-full md:m-4 md:rounded-xl shadow-2xl flex flex-col overflow-hidden md:max-w-5xl md:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {activeTicketId !== null ? (
          <TicketDetail
            userId={userId}
            userName={userName}
            ticketId={activeTicketId}
            mode="user"
            onBack={() => { setActiveTicketId(null); load(); }}
            onTicketUpdated={() => load()}
          />
        ) : (
          <>
            {/* Заголовок */}
            <div className="flex items-center justify-between gap-3 p-4 border-b">
              <h2 className="text-xl sm:text-2xl font-bold">Обращения</h2>
              <div className="flex items-center gap-2">
                <Button onClick={() => setCreating(true)} className="gap-2">
                  <Icon name="Plus" size={16} />
                  <span className="hidden sm:inline">Создать обращение</span>
                  <span className="sm:hidden">Создать</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <Icon name="X" size={20} />
                </Button>
              </div>
            </div>

            {/* Поиск + фильтр */}
            <div className="flex flex-col sm:flex-row gap-2 p-4 border-b">
              <div className="relative flex-1">
                <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по теме..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={(v: Filter) => setFilter(v)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Открытые</SelectItem>
                  <SelectItem value="closed">Закрытые</SelectItem>
                  <SelectItem value="all">Все</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Список */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Icon name="Inbox" size={32} className="opacity-40" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      {search ? 'Ничего не найдено' : 'Обращений пока нет'}
                    </p>
                    <p className="text-sm">Нажмите «Создать обращение», чтобы написать в поддержку</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Десктоп: таблица */}
                  <table className="hidden md:table w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="py-3 px-4 font-medium">#</th>
                        <th className="py-3 px-4 font-medium">Статус</th>
                        <th className="py-3 px-4 font-medium">Приоритет</th>
                        <th className="py-3 px-4 font-medium">Тема</th>
                        <th className="py-3 px-4 font-medium">Последнее сообщение</th>
                        <th className="py-3 px-4 font-medium text-right">Создан</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => setActiveTicketId(t.id)}
                        >
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{t.ticket_number}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(t.status)}`}>
                              {STATUS_LABELS[t.status]}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <Icon name="Circle" size={10} className={priorityDot(t.priority)} />
                              {PRIORITY_LABELS[t.priority]}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            <div className="flex items-center gap-2">
                              {t.subject}
                              {t.user_unread_count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                  {t.user_unread_count}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-[240px] truncate">{t.last_message_preview}</td>
                          <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap">{formatTicketTime(t.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Мобайл: карточки */}
                  <div className="md:hidden divide-y">
                    {filtered.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTicketId(t.id)}
                        className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(t.status)}`}>
                            {STATUS_LABELS[t.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-medium mb-1">
                          <span className="truncate">{t.subject}</span>
                          {t.user_unread_count > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                              {t.user_unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{t.last_message_preview}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="Circle" size={9} className={priorityDot(t.priority)} />
                            {PRIORITY_LABELS[t.priority]}
                          </span>
                          <span>{REQUEST_TYPE_LABELS[t.request_type]}</span>
                          <span className="ml-auto">{formatTicketTime(t.created_at)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <CreateTicketDialog
        open={creating}
        onClose={() => setCreating(false)}
        userId={userId}
        userName={userName}
        userEmail={userEmail}
        onCreated={(ticket) => {
          setCreating(false);
          setActiveTicketId(ticket.id);
        }}
      />
    </div>
  );
}
