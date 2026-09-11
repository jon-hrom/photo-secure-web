import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';
import { createMeeting } from '@/components/clients/dialog/MeetingService';
import DurationSelect from '@/components/clients/detail/project-detail/DurationSelect';
import { getUserTimezoneShort } from '@/utils/regionTimezone';

interface QuickMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  clients: Client[];
  onCreated?: () => void;
}

const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const QuickMeetingDialog = ({ open, onOpenChange, date, clients, onCreated }: QuickMeetingDialogProps) => {
  const [clientId, setClientId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(null);
    setSearch('');
    setName('');
    setMeetingTime('');
    setDuration(60);
    setAddress('');
    setDescription('');
    setReminderAt('');
    setMeetingDate(date ? toDateInput(date) : '');
  }, [open, date]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId]
  );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!q) return list.slice(0, 50);
    return list
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [clients, search]);

  const prettyDate = date
    ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const handleSave = async () => {
    if (!selectedClient) {
      toast.error('Выберите клиента');
      return;
    }
    if (!meetingDate) {
      toast.error('Укажите дату встречи');
      return;
    }
    setSaving(true);
    const loader = toast.loading('Создаём встречу и отправляем уведомления...');
    const result = await createMeeting(
      selectedClient.id,
      {
        name: name || 'Встреча',
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        duration,
        address,
        description,
        custom_reminder_at: reminderAt,
      },
      !!selectedClient.phone || !!selectedClient.telegram_chat_id,
      true
    );
    toast.dismiss(loader);
    setSaving(false);

    if (result.ok) {
      toast.success('Встреча создана', {
        description: 'Уведомления отправлены клиенту и вам',
        duration: 6000,
      });
      onOpenChange(false);
      onCreated?.();
      window.dispatchEvent(new CustomEvent('meetings:refresh'));
      window.dispatchEvent(new CustomEvent('clients:refresh'));
    } else {
      toast.error('Не удалось создать встречу', { description: result.error });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon name="CalendarPlus" size={18} className="text-violet-500" />
            Новая встреча
          </DialogTitle>
          <DialogDescription className="text-xs">
            {prettyDate ? `Свободная дата — ${prettyDate}` : 'Заполните данные встречи'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Клиент *</Label>
            {selectedClient ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{selectedClient.name}</div>
                  {selectedClient.phone && (
                    <div className="text-[11px] text-muted-foreground truncate">{selectedClient.phone}</div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setClientId(null)}>
                  Изменить
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени, телефону, email"
                  className="text-xs h-9 border-0 border-b rounded-none focus-visible:ring-0"
                />
                <div className="max-h-44 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Клиенты не найдены
                    </div>
                  ) : (
                    filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClientId(c.id)}
                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                      >
                        <div className="text-xs font-medium truncate">{c.name}</div>
                        {c.phone && (
                          <div className="text-[10px] text-muted-foreground truncate">{c.phone}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Название встречи</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Обсуждение съёмки"
              className="text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Дата встречи *</Label>
              <Input
                type="date"
                min="2020-01-01"
                max="2099-12-31"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Время <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span>
              </Label>
              <Input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Длительность</Label>
              <DurationSelect value={duration} onChange={setDuration} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Адрес встречи</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Кафе на Тверской, Москва"
              className="text-xs h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Описание</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чём встреча..."
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="rounded-lg border border-border/60 p-3 space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <Icon name="BellRing" size={13} className="text-violet-500" />
              Доп. напоминание фотографу
            </Label>
            <Input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              className="text-xs h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              Кроме стандартных (за сутки и за 5 часов) — придёт вам в указанное время
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Отмена
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  Сохраняем...
                </>
              ) : (
                <>
                  <Icon name="Check" size={16} className="mr-2" />
                  Создать встречу
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickMeetingDialog;
