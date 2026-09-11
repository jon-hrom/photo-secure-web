import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';
import { Meeting, updateMeeting, deleteMeeting } from '@/components/clients/dialog/MeetingService';
import { formatMinutes } from '@/utils/dateFormat';

interface MeetingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetings: Meeting[];
  clients: Client[];
  date: Date | null;
}

const formatTime = (time?: string | null) => {
  if (!time) return 'время не указано';
  return String(time).slice(0, 5);
};

const MeetingDetailsDialog = ({
  open,
  onOpenChange,
  meetings,
  clients,
  date,
}: MeetingDetailsDialogProps) => {
  const [busyId, setBusyId] = useState<number | null>(null);

  const prettyDate = date
    ? date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long',
      })
    : '';

  const clientById = useMemo(() => {
    const map = new Map<number, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const handleCancel = async (meeting: Meeting) => {
    const client = clientById.get(meeting.client_id);
    setBusyId(meeting.id);
    const loader = toast.loading('Отменяем встречу...');

    const ok = await updateMeeting(meeting.id, {
      status: 'cancelled',
      notification_type: 'cancellation',
      notify_client: !!(client?.phone || client?.telegram_chat_id),
    });

    toast.dismiss(loader);
    setBusyId(null);

    if (ok) {
      toast.success('Встреча отменена', { description: 'Клиенту отправлено уведомление' });
      window.dispatchEvent(new CustomEvent('meetings:refresh'));
      onOpenChange(false);
    } else {
      toast.error('Не удалось отменить встречу');
    }
  };

  const handleDelete = async (meeting: Meeting) => {
    setBusyId(meeting.id);
    const loader = toast.loading('Удаляем встречу...');
    const ok = await deleteMeeting(meeting.id);
    toast.dismiss(loader);
    setBusyId(null);

    if (ok) {
      toast.success('Встреча удалена');
      window.dispatchEvent(new CustomEvent('meetings:refresh'));
      onOpenChange(false);
    } else {
      toast.error('Не удалось удалить встречу');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon name="Handshake" size={18} className="text-blue-500" />
            {meetings.length > 1 ? `Встречи (${meetings.length})` : 'Встреча'}
          </DialogTitle>
          <DialogDescription className="text-xs capitalize">{prettyDate}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {meetings.map((meeting) => {
            const client = clientById.get(meeting.client_id);
            const isBusy = busyId === meeting.id;

            return (
              <div
                key={meeting.id}
                className="rounded-lg border border-blue-200/60 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug">
                    {meeting.name || 'Встреча'}
                  </h3>
                  <span className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 rounded px-2 py-0.5">
                    {formatTime(meeting.meeting_time)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {client && (
                    <div className="flex items-start gap-2">
                      <Icon name="User" size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{client.name}</div>
                        {client.phone && (
                          <a
                            href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            {client.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {meeting.duration ? (
                    <div className="flex items-center gap-2">
                      <Icon name="Clock" size={13} className="shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{formatMinutes(meeting.duration)}</span>
                    </div>
                  ) : null}

                  {meeting.address && (
                    <div className="flex items-start gap-2">
                      <Icon name="MapPin" size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <a
                        href={`https://yandex.ru/maps/?text=${encodeURIComponent(meeting.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors break-words"
                      >
                        {meeting.address}
                      </a>
                    </div>
                  )}

                  {meeting.description && (
                    <div className="flex items-start gap-2">
                      <Icon name="FileText" size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground break-words">{meeting.description}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    disabled={isBusy}
                    onClick={() => handleCancel(meeting)}
                  >
                    <Icon name="CalendarX" size={13} className="mr-1.5" />
                    Отменить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    disabled={isBusy}
                    onClick={() => handleDelete(meeting)}
                  >
                    <Icon name="Trash2" size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingDetailsDialog;
