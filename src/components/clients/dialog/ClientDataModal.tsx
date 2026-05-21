import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { formatPhoneNumber } from '@/utils/phoneFormat';
import { Client } from '@/components/clients/ClientsTypes';

const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';

interface ClientDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  onUpdate: (client: Client) => void;
}

const ClientDataModal = ({ open, onOpenChange, client, onUpdate }: ClientDataModalProps) => {
  const [form, setForm] = useState<Client>(client);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(client);
  }, [open, client]);

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 11;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Укажите ФИО клиента');
      return;
    }
    if (!validatePhone(form.phone || '')) {
      toast.error('Телефон должен содержать 11 цифр (включая +7)');
      return;
    }

    const userId = localStorage.getItem('userId');
    setSaving(true);
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || '',
        },
        body: JSON.stringify({
          ...form,
          vk_username: form.vk_username,
          birthdate: form.birthdate,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      onUpdate(form);
      toast.success('Данные клиента обновлены');
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Не удалось обновить данные');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md flex flex-col max-h-[90vh] sm:max-h-[85vh] p-0 gap-0"
        aria-describedby="client-data-description"
      >
        <div className="flex-shrink-0 p-4 sm:p-6 pb-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="UserCog" size={20} className="text-primary" />
              Данные клиента
            </DialogTitle>
          </DialogHeader>
          <div id="client-data-description" className="sr-only">
            Просмотр и редактирование данных клиента
          </div>
        </div>

        <div
          className="space-y-3 sm:space-y-4 px-4 sm:px-6 overflow-y-auto overscroll-contain touch-pan-y flex-1 min-h-0 pb-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cd-name" className="text-sm">ФИО *</Label>
            <Input
              id="cd-name"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-10 text-sm sm:text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-phone" className="text-sm">Телефон *</Label>
            <Input
              id="cd-phone"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })}
              maxLength={18}
              className="h-10 text-sm sm:text-base"
            />
            <p className="text-[11px] text-muted-foreground">Формат: +7 (999) 123-45-67</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-email" className="text-sm">Email</Label>
            <Input
              id="cd-email"
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-10 text-sm sm:text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-birthdate" className="text-sm">Дата рождения</Label>
            <Input
              id="cd-birthdate"
              type="date"
              value={form.birthdate || ''}
              onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
              className="h-10 text-sm sm:text-base"
            />
            <p className="text-[11px] text-muted-foreground">Для автоматических поздравлений</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-address" className="text-sm">Адрес</Label>
            <Input
              id="cd-address"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="h-10 text-sm sm:text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-vk" className="text-sm">ВКонтакте</Label>
            <Input
              id="cd-vk"
              value={form.vkProfile || ''}
              onChange={(e) => setForm({ ...form, vkProfile: e.target.value })}
              placeholder="https://vk.com/username или @username"
              className="h-10 text-sm sm:text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-tg" className="text-sm">Telegram Chat ID</Label>
            <Input
              id="cd-tg"
              value={form.telegram_chat_id || ''}
              onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
              placeholder="Например: 123456789"
              className="h-10 text-sm sm:text-base"
            />
            <p className="text-[11px] text-muted-foreground">Для уведомлений о съёмках в Telegram</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-comments" className="text-sm">Дополнительные заметки</Label>
            <Textarea
              id="cd-comments"
              value={form.project_comments || ''}
              onChange={(e) => setForm({ ...form, project_comments: e.target.value })}
              placeholder="Любые важные детали о клиенте..."
              className="text-sm sm:text-base min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-background flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11"
            type="button"
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 h-11 font-semibold"
            type="button"
            disabled={saving}
          >
            <Icon name={saving ? 'Loader2' : 'Save'} size={18} className={saving ? 'mr-1.5 animate-spin' : 'mr-1.5'} />
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDataModal;
