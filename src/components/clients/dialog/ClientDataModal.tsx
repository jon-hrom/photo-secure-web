import { useEffect, useRef, useState } from 'react';
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
  const [avatarLoading, setAvatarLoading] = useState<'upload' | 'vk' | 'remove' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setForm(client);
  }, [open, client]);

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 11;
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUploadAvatar = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5 МБ');
      return;
    }
    const userId = localStorage.getItem('userId');
    setAvatarLoading('upload');
    try {
      const file_data = await fileToBase64(file);
      const res = await fetch(CLIENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({
          action: 'upload_avatar',
          client_id: form.id,
          file_data,
          file_name: file.name,
          content_type: file.type || 'image/jpeg',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      setForm((prev) => ({ ...prev, avatar_url: data.avatar_url }));
      onUpdate({ ...form, avatar_url: data.avatar_url });
      toast.success('Фото загружено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить фото');
    } finally {
      setAvatarLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportFromVK = async () => {
    if (!form.vkProfile && !client.vkProfile) {
      toast.error('Сначала укажите ссылку на профиль ВКонтакте');
      return;
    }
    const userId = localStorage.getItem('userId');
    setAvatarLoading('vk');
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({
          action: 'import_vk_avatar',
          client_id: form.id,
          vk_profile: form.vkProfile || client.vkProfile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка импорта');
      setForm((prev) => ({ ...prev, avatar_url: data.avatar_url }));
      onUpdate({ ...form, avatar_url: data.avatar_url });
      toast.success('Фото подтянуто из ВКонтакте');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось получить фото из ВК');
    } finally {
      setAvatarLoading(null);
    }
  };

  const handleRemoveAvatar = async () => {
    const userId = localStorage.getItem('userId');
    setAvatarLoading('remove');
    try {
      const res = await fetch(CLIENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ action: 'remove_avatar', client_id: form.id }),
      });
      if (!res.ok) throw new Error('Не удалось удалить');
      setForm((prev) => ({ ...prev, avatar_url: null }));
      onUpdate({ ...form, avatar_url: null });
      toast.success('Фото удалено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setAvatarLoading(null);
    }
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
          avatar_url: form.avatar_url,
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

  const initials = (form.name || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

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
          <div className="flex items-center gap-3 sm:gap-4 p-3 rounded-lg border bg-muted/30">
            <div className="relative shrink-0">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt={form.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-background shadow"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary border-2 border-background shadow">
                  {initials || <Icon name="User" size={28} />}
                </div>
              )}
              {avatarLoading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Icon name="Loader2" size={22} className="text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadAvatar(f);
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!avatarLoading}
                >
                  <Icon name="Upload" size={14} className="mr-1" />
                  Загрузить
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleImportFromVK}
                  disabled={!!avatarLoading || (!form.vkProfile && !client.vkProfile)}
                  title={!form.vkProfile && !client.vkProfile ? 'Сначала укажите ссылку на ВК ниже' : 'Подтянуть аватар из ВКонтакте'}
                >
                  <Icon name="Download" size={14} className="mr-1" />
                  Из ВК
                </Button>
                {form.avatar_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-600 hover:text-red-700"
                    onClick={handleRemoveAvatar}
                    disabled={!!avatarLoading}
                  >
                    <Icon name="Trash2" size={14} className="mr-1" />
                    Удалить
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">JPG/PNG до 5 МБ. «Из ВК» подтянет фото профиля автоматически.</p>
            </div>
          </div>

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
            <p className="text-[11px] text-muted-foreground">Можно подтянуть аватар отсюда кнопкой «Из ВК».</p>
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