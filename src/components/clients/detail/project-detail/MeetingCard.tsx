import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import { Meeting } from '@/components/clients/dialog/MeetingService';
import DurationSelect from './DurationSelect';

interface MeetingCardProps {
  meeting: Meeting;
  onSave: (id: number, updates: Partial<Meeting>) => Promise<void> | void;
  onCancel: (id: number, reason: string) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const MeetingCard = ({ meeting, onSave, onCancel, onDelete }: MeetingCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState({
    name: meeting.name || 'Встреча',
    meeting_date: (meeting.meeting_date || '').slice(0, 10),
    meeting_time: (meeting.meeting_time || '').slice(0, 5),
    duration: meeting.duration || 60,
    address: meeting.address || '',
    description: meeting.description || '',
    custom_reminder_at: (meeting.custom_reminder_at || '').slice(0, 16),
  });

  const isCancelled = meeting.status === 'cancelled';

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave(meeting.id, {
        name: draft.name || 'Встреча',
        meeting_date: draft.meeting_date,
        meeting_time: draft.meeting_time || null,
        duration: draft.duration,
        address: draft.address,
        description: draft.description,
        custom_reminder_at: draft.custom_reminder_at || null,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await onCancel(meeting.id, cancelReason);
      setCancelMode(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={`border ${isCancelled ? 'border-red-300 dark:border-red-800 opacity-80' : 'border-violet-200 dark:border-violet-900'}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <button
            className="flex items-start gap-2 text-left flex-1 min-w-0"
            onClick={() => setExpanded((v) => !v)}
          >
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/50 shrink-0">
              <Icon name="Handshake" size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate">{meeting.name || 'Встреча'}</span>
                <Badge className="bg-violet-500 hover:bg-violet-500 text-white border-0 text-[9px] uppercase font-bold px-1.5 py-0">Встреча</Badge>
                {isCancelled && (
                  <Badge className="bg-red-500 hover:bg-red-500 text-white border-0 text-[9px] uppercase font-bold px-1.5 py-0">Отменена</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatDate(meeting.meeting_date)}{meeting.meeting_time ? `, ${meeting.meeting_time.slice(0, 5)}` : ''}
              </div>
            </div>
          </button>
          <Icon
            name={expanded ? 'ChevronUp' : 'ChevronDown'}
            size={18}
            className="text-muted-foreground shrink-0 cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
          />
        </div>

        {expanded && !editing && !cancelMode && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="Calendar" size={13} />
                {formatDate(meeting.meeting_date)}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="Clock" size={13} />
                {meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : '—'} · {meeting.duration || 60} мин
              </div>
            </div>
            {meeting.address && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Icon name="MapPin" size={13} className="mt-0.5 shrink-0" />
                <span>{meeting.address}</span>
              </div>
            )}
            {meeting.description && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Icon name="FileText" size={13} className="mt-0.5 shrink-0" />
                <span>{meeting.description}</span>
              </div>
            )}
            {meeting.custom_reminder_at && (
              <div className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                <Icon name="BellRing" size={13} />
                Доп. напоминание: {formatDate(meeting.custom_reminder_at)}, {meeting.custom_reminder_at.slice(11, 16)}
              </div>
            )}

            {!isCancelled && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing(true)}>
                  <Icon name="Pencil" size={13} className="mr-1" />
                  Перенести / изменить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-red-600 hover:text-red-700 border-red-200"
                  onClick={() => setCancelMode(true)}
                >
                  <Icon name="XCircle" size={13} className="mr-1" />
                  Отменить встречу
                </Button>
              </div>
            )}
            {isCancelled && (
              <>
                {meeting.cancel_reason && (
                  <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded px-2 py-1">
                    Причина отмены: {meeting.cancel_reason}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-red-600"
                  onClick={() => onDelete(meeting.id)}
                >
                  <Icon name="Trash2" size={13} className="mr-1" />
                  Удалить
                </Button>
              </>
            )}
          </div>
        )}

        {expanded && editing && (
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Название встречи</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="text-xs h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Дата</Label>
                <Input type="date" value={draft.meeting_date} onChange={(e) => setDraft({ ...draft, meeting_date: e.target.value })} className="text-xs h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Время <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
                <Input type="time" value={draft.meeting_time} onChange={(e) => setDraft({ ...draft, meeting_time: e.target.value })} className="text-xs h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Длительность (минуты)</Label>
              <DurationSelect value={draft.duration} onChange={(d) => setDraft({ ...draft, duration: d })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Адрес встречи</Label>
              <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className="text-xs h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Описание</Label>
              <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className="text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Icon name="BellRing" size={12} className="text-violet-500" />
                Доп. напоминание фотографу
              </Label>
              <Input type="datetime-local" value={draft.custom_reminder_at} onChange={(e) => setDraft({ ...draft, custom_reminder_at: e.target.value })} className="text-xs h-9" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={busy}>
                <Icon name={busy ? 'Loader2' : 'Save'} size={13} className={`mr-1${busy ? ' animate-spin' : ''}`} />
                Сохранить и уведомить
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)} disabled={busy}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {expanded && cancelMode && (
          <div className="space-y-2 pt-1">
            <Label className="text-xs">Причина отмены (необязательно)</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} className="text-xs" placeholder="Например: клиент попросил перенести" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleCancel} disabled={busy}>
                <Icon name={busy ? 'Loader2' : 'XCircle'} size={13} className={`mr-1${busy ? ' animate-spin' : ''}`} />
                Подтвердить отмену
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCancelMode(false)} disabled={busy}>
                Назад
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MeetingCard;
