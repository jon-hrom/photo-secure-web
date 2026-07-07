import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const VK_SETTINGS_API = 'https://functions.poehali.dev/f19f02aa-569b-49f2-b9d6-3036bffb9e73';

const VKSettings = ({ userId }: { userId: string | null }) => {
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState('');
  const [groupToken, setGroupToken] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupConnected, setGroupConnected] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [userId]);

  const checkConnection = async () => {
    const effectiveUserId = userId || localStorage.getItem('userId');
    if (!effectiveUserId) return;

    setLoading(true);
    try {
      const response = await fetch(VK_SETTINGS_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': effectiveUserId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGroupId(data.vk_group_id || '');
        setGroupConnected(!!(data.vk_group_token && data.vk_group_id));
      }
    } catch (error) {
      console.error('Error checking VK connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    const effectiveUserId = userId || localStorage.getItem('userId');
    if (!effectiveUserId) {
      toast.error('Не удалось определить пользователя');
      return;
    }
    if (!groupId.trim()) {
      toast.error('Укажите ID сообщества');
      return;
    }

    setSavingGroup(true);
    try {
      const payload: Record<string, string> = { vk_group_id: groupId.trim() };
      if (groupToken.trim()) payload.vk_group_token = groupToken.trim();

      const response = await fetch(VK_SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': effectiveUserId },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await checkConnection();
        setGroupToken('');
        toast.success('Сообщество сохранено');
      } else {
        toast.error('Не удалось сохранить сообщество');
      }
    } catch (error) {
      toast.error('Ошибка при сохранении');
    } finally {
      setSavingGroup(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Icon name="MessageCircle" size={24} className="text-blue-600" />
            <CardTitle>Подключение ВКонтакте</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={32} className="animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Icon name="MessageCircle" size={24} className="text-blue-600" />
          <div>
            <CardTitle>Подключение ВКонтакте</CardTitle>
            <CardDescription>
              Отправляйте уведомления о съёмках клиентам в ВК одной кнопкой
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="Users" size={20} className="text-blue-600" />
            <div>
              <p className="font-semibold">Сообщество ВКонтакте</p>
              <p className="text-sm text-muted-foreground">
                Для публикации постов с фото в группу и уведомлений клиентам в личку
              </p>
            </div>
            {groupConnected && (
              <span className="ml-auto inline-flex items-center gap-1 text-sm text-green-600">
                <Icon name="CheckCircle2" size={16} /> Подключено
              </span>
            )}
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/20">
                <Icon name="BookOpen" size={18} className="mr-2" />
                Инструкция по подключению
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Как подключить сообщество ВКонтакте</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 text-sm leading-relaxed">
                <div className="space-y-2">
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Шаг 1. Создайте ключ доступа</p>
                  <p className="text-muted-foreground">
                    В своём сообществе ВК откройте: <strong>Управление → Работа с API → Ключи доступа</strong> и нажмите <strong>«Создать ключ»</strong>.
                  </p>
                  <p className="text-muted-foreground">Отметьте галочками права:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Управление сообществом</li>
                    <li>Сообщения сообщества <span className="text-xs">(чтобы писать клиентам в личку)</span></li>
                    <li>Доступ к фотографиям <span className="text-xs">(для фото в постах)</span></li>
                    <li>Работа со стеной <span className="text-xs">(для публикации записей)</span></li>
                  </ul>
                  <p className="text-muted-foreground">
                    Нажмите <strong>«Создать»</strong>, подтвердите кодом из SMS и скопируйте ключ — он начинается с <code className="bg-muted px-1 rounded">vk1.a...</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Шаг 2. Разрешите сообщения</p>
                  <p className="text-muted-foreground">
                    Откройте <strong>Управление → Сообщения</strong> и включите переключатель <strong>«Сообщения сообщества»</strong> в положение «Включены».
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Шаг 3. Заполните поля ниже</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>ID сообщества</strong> — короткое имя или числовой ID группы</li>
                    <li><strong>Токен сообщества</strong> — вставьте скопированный ключ <code className="bg-muted px-1 rounded">vk1.a...</code></li>
                  </ul>
                  <p className="text-muted-foreground">Нажмите «Сохранить сообщество» — готово!</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            <Label htmlFor="vk-group-id">ID или короткое имя сообщества</Label>
            <Input
              id="vk-group-id"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="Например: 123456789 или mystudio"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vk-group-token">
              Токен сообщества {groupConnected && <span className="text-muted-foreground">(оставьте пустым, чтобы не менять)</span>}
            </Label>
            <Input
              id="vk-group-token"
              type="password"
              value={groupToken}
              onChange={(e) => setGroupToken(e.target.value)}
              placeholder="vk1.a.xxxxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Не знаете, где взять токен? Нажмите «Инструкция по подключению» выше.
            </p>
          </div>

          <Button
            onClick={handleSaveGroup}
            disabled={savingGroup || !groupId.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {savingGroup ? (
              <>
                <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Icon name="Save" size={20} className="mr-2" />
                Сохранить сообщество
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default VKSettings;