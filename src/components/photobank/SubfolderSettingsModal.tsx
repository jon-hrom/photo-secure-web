import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface SubfolderSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subfolder: {
    id: number;
    folder_name: string;
    has_password?: boolean;
    is_hidden?: boolean;
  } | null;
  apiUrl: string;
  userId: string;
  onSaved: () => void;
}

export default function SubfolderSettingsModal({
  open,
  onOpenChange,
  subfolder,
  apiUrl,
  userId,
  onSaved
}: SubfolderSettingsModalProps) {
  const { toast } = useToast();
  const [folderName, setFolderName] = useState('');
  const [password, setPassword] = useState('');
  const [isHidden, setIsHidden] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subfolder) {
      setFolderName(subfolder.folder_name);
      setHasPassword(!!subfolder.has_password);
      setIsHidden(!!subfolder.is_hidden);
      setPassword('');
    }
  }, [subfolder]);

  const handleSave = async () => {
    if (!subfolder) return;
    setSaving(true);
    try {
      const body: Record<string, string | number | boolean> = {
        action: 'update_subfolder_settings',
        folder_id: subfolder.id,
      };

      if (folderName !== subfolder.folder_name) {
        body.folder_name = folderName;
      }

      if (!hasPassword && subfolder.has_password) {
        body.password = '';
      } else if (hasPassword && password) {
        body.password = password;
      }

      body.is_hidden = isHidden;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast({ title: 'Сохранено', description: 'Настройки папки обновлены' });
        onSaved();
        onOpenChange(false);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка сохранения');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Не удалось сохранить';
      toast({ title: 'Ошибка', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/80 dark:via-pink-950/60 dark:to-rose-950/80 backdrop-blur-sm max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Settings" size={20} />
            Настройки папки
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subfolder-name">Название</Label>
            <Input
              id="subfolder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Название папки"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-background/60 border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Icon name="Lock" size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Пароль</p>
                <p className="text-xs text-muted-foreground">Клиент должен ввести пароль</p>
              </div>
            </div>
            <Switch checked={hasPassword} onCheckedChange={setHasPassword} />
          </div>

          {hasPassword && (
            <div className="space-y-2 pl-2">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={subfolder?.has_password ? 'Оставьте пустым, чтобы не менять' : 'Введите пароль'}
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-background/60 border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Icon name="EyeOff" size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Скрыть папку</p>
                <p className="text-xs text-muted-foreground">Не будет видна клиентам по ссылке</p>
              </div>
            </div>
            <Switch checked={isHidden} onCheckedChange={setIsHidden} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}