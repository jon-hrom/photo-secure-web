import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Ticket, TicketMessage, NewAttachment, TicketUserInfo,
  fetchTicket, sendTicketMessage, closeTicket, reopenTicket,
  adminFetchTicket, adminSendMessage, adminSetStatus,
  fileToAttachment, formatTicketTime,
  STATUS_LABELS, PRIORITY_LABELS,
} from './supportTicketsApi';

const formatClosedDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const cleaned = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

interface TicketDetailProps {
  userId: string | number;
  userName?: string;
  ticketId: number;
  mode: 'user' | 'admin';
  onBack: () => void;
  onTicketUpdated?: (ticket: Ticket) => void;
}

const POLL_INTERVAL = 15000;

const statusBadgeClass = (status: string) => {
  if (status === 'closed') return 'bg-muted text-muted-foreground';
  if (status === 'in_progress') return 'bg-orange-500/15 text-orange-500';
  return 'bg-blue-500/15 text-blue-500';
};

export default function TicketDetail({ userId, userName, ticketId, mode, onBack, onTicketUpdated }: TicketDetailProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [userInfo, setUserInfo] = useState<TicketUserInfo | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<{ att: NewAttachment; preview: string }[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = mode === 'admin'
        ? await adminFetchTicket(userId, ticketId)
        : await fetchTicket(userId, ticketId);
      if (data.ticket) {
        setTicket(data.ticket);
        setMessages(data.messages || []);
        if (mode === 'admin' && 'user_info' in data && data.user_info) {
          setUserInfo(data.user_info);
        }
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, ticketId, mode]);

  useEffect(() => {
    load(false);
    const interval = setInterval(() => {
      if (!isTypingRef.current) load(true);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 6 - attachments.length);
    for (const file of arr) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`Файл «${file.name}» больше 8 МБ`);
        continue;
      }
      const att = await fileToAttachment(file);
      setAttachments(prev => [...prev, { att, preview: att.data }]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSend = async () => {
    const text = reply.trim();
    if ((!text && attachments.length === 0) || sending) return;
    setSending(true);
    try {
      const payload = { ticket_id: ticketId, message: text, attachments: attachments.map(a => a.att) };
      const res = mode === 'admin'
        ? await adminSendMessage(userId, payload)
        : await sendTicketMessage(userId, { ...payload, user_name: userName });
      if (res.success && res.message) {
        setMessages(prev => [...prev, res.message!]);
        setReply('');
        setAttachments([]);
        load(true);
      } else {
        toast.error('Не удалось отправить');
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!confirm('Закрыть обращение?')) return;
    const res = mode === 'admin'
      ? await adminSetStatus(userId, ticketId, 'closed')
      : await closeTicket(userId, ticketId);
    if (res.success && res.ticket) {
      setTicket(res.ticket);
      onTicketUpdated?.(res.ticket);
      toast.success('Обращение закрыто');
    }
  };

  const handleReopen = async () => {
    const res = mode === 'admin'
      ? await adminSetStatus(userId, ticketId, 'open')
      : await reopenTicket(userId, ticketId);
    if (res.success && res.ticket) {
      setTicket(res.ticket);
      onTicketUpdated?.(res.ticket);
      toast.success('Обращение переоткрыто');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Icon name="FileQuestion" size={32} className="opacity-40" />
        <p>Обращение не найдено</p>
        <Button variant="outline" onClick={onBack}>Назад</Button>
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <Icon name="ArrowLeft" size={20} />
          </Button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold truncate">{ticket.subject}</h2>
            <p className="text-xs text-muted-foreground">{ticket.ticket_number}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${statusBadgeClass(ticket.status)}`}>
          {STATUS_LABELS[ticket.status]}
        </span>
      </div>

      {/* Данные фотографа (только для админа) */}
      {mode === 'admin' && userInfo && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 border-b bg-muted/40 text-xs">
          {userInfo.full_name && (
            <span className="flex items-center gap-1.5 text-foreground font-medium">
              <Icon name="User" size={14} className="text-muted-foreground" />
              {userInfo.full_name}
            </span>
          )}
          {userInfo.id && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Icon name="Hash" size={14} />
              ID {userInfo.id}
            </span>
          )}
          {userInfo.email && (
            <a href={`mailto:${userInfo.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
              <Icon name="Mail" size={14} />
              {userInfo.email}
            </a>
          )}
          {userInfo.phone && (
            <a href={`tel:${userInfo.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
              <Icon name="Phone" size={14} />
              {userInfo.phone}
            </a>
          )}
        </div>
      )}

      {/* Тело */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col lg:flex-row gap-4 p-4">
          {/* Левая часть: первое сообщение + переписка */}
          <div className="flex-1 min-w-0 space-y-5">
            {isClosed && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <Icon name="CheckCircle2" size={18} className="shrink-0" />
                  <span>
                    Обращение закрыто{ticket.closed_at ? ` ${formatClosedDate(ticket.closed_at)}` : ''}
                  </span>
                </div>
                <Button size="sm" variant="secondary" onClick={handleReopen} className="shrink-0">
                  Переоткрыть
                </Button>
              </div>
            )}
            <div className="relative text-center">
              <span className="bg-background px-3 text-xs text-muted-foreground relative z-10">
                Сообщения ({messages.length})
              </span>
              <div className="absolute top-1/2 left-0 right-0 border-t -z-0" />
            </div>

            <div className="space-y-5">
              {messages.map((m) => {
                const isAdmin = m.sender === 'admin';
                return (
                  <div key={m.id} className="flex gap-3">
                    <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white ${isAdmin ? 'bg-green-600' : 'bg-blue-500'}`}>
                      {isAdmin ? <Icon name="Headset" size={16} /> : (m.sender_name || 'Я').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{isAdmin ? 'Поддержка' : (m.sender_name || 'Вы')}</span>
                        <span className="text-xs text-muted-foreground">{formatTicketTime(m.created_at)}</span>
                      </div>
                      {m.body && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                      )}
                      <MessageAttachments atts={m.attachments} />
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Правая панель: статус и закрытие */}
          <div className="lg:w-64 shrink-0 space-y-3">
            <div className="rounded-xl border p-4 space-y-3">
              <div>
                <p className="text-sm">{PRIORITY_LABELS[ticket.priority]} приоритет</p>
                <p className="text-xs text-muted-foreground">Ответ обычно в течение 1 дня</p>
              </div>
              {!isClosed && (
                <Button variant="secondary" className="w-full" onClick={handleClose}>
                  Закрыть обращение
                </Button>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground px-2">
              Поддержка работает ежедневно, с 10:00 до 20:00 МСК
            </p>
          </div>
        </div>
      </div>

      {/* Поле ответа */}
      {isClosed ? (
        <div className="border-t p-4 text-center text-sm text-muted-foreground">
          Обращение закрыто
        </div>
      ) : (
        <div className="border-t p-3 sm:p-4">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border">
                  <img src={a.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                  >
                    <Icon name="X" size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl border bg-muted/30 p-2">
            <textarea
              value={reply}
              onChange={(e) => { setReply(e.target.value); isTypingRef.current = true; }}
              onBlur={() => { isTypingRef.current = false; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Напишите ответ..."
              rows={2}
              className="w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2"
              >
                <Icon name="ImagePlus" size={18} />
                <span className="hidden sm:inline">Прикрепить</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <Button size="icon" className="rounded-full h-9 w-9" onClick={handleSend} disabled={sending}>
                {sending ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name="ArrowUp" size={18} />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageAttachments({ atts }: { atts: { name: string; url: string; type?: string }[] }) {
  if (!atts || atts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {atts.map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block h-24 w-24 rounded-lg overflow-hidden border hover:opacity-90">
          {(a.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(a.url) ? (
            <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-muted text-xs text-muted-foreground gap-1 p-1">
              <Icon name="File" size={20} />
              <span className="truncate w-full text-center">{a.name}</span>
            </div>
          )}
        </a>
      ))}
    </div>
  );
}