import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import VKAccountsList, { VKAccount } from './vk/VKAccountsList';
import VKAccountForm from './vk/VKAccountForm';
import VKInstructions from './vk/VKInstructions';

const VK_ACCOUNTS_API = 'https://functions.poehali.dev/52780632-e8cf-495e-a573-78e5eeea2ef9';

const VKSettings = ({ userId }: { userId: string | null }) => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<VKAccount[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VKAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const getUserId = useCallback(
    () => userId || localStorage.getItem('userId'),
    [userId],
  );

  const request = useCallback(
    async (method: 'GET' | 'POST', payload?: Record<string, unknown>) => {
      const uid = getUserId();
      if (!uid) return null;
      const res = await fetch(VK_ACCOUNTS_API, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-User-Id': uid },
        body: method === 'POST' ? JSON.stringify(payload || {}) : undefined,
      });
      return res.json();
    },
    [getUserId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('GET');
      if (data?.success) setAccounts(data.accounts || []);
    } catch {
      toast.error('Не удалось загрузить подключения ВК');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (payload: {
    id?: number;
    kind: 'group' | 'user';
    vk_target_id: string;
    access_token: string;
    title: string;
  }) => {
    setSaving(true);
    try {
      const data = await request('POST', { action: 'save', ...payload });
      if (data?.success) {
        setAccounts(data.accounts || []);
        setFormOpen(false);
        setEditing(null);
        toast.success('Подключение сохранено');
      } else {
        toast.error(data?.error || 'Не удалось сохранить', { duration: 8000 });
      }
    } catch {
      toast.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc: VKAccount) => {
    if (!confirm(`Удалить подключение «${acc.title}»?`)) return;
    setBusyId(acc.id);
    try {
      const data = await request('POST', { action: 'delete', id: acc.id });
      if (data?.success) {
        setAccounts(data.accounts || []);
        toast.success('Подключение удалено');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (acc: VKAccount) => {
    setBusyId(acc.id);
    try {
      const data = await request('POST', { action: 'set_default', id: acc.id });
      if (data?.success) {
        setAccounts(data.accounts || []);
        toast.success(`«${acc.title}» — теперь основной аккаунт`);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Icon name="MessageCircle" size={24} className="text-blue-600" />
          <div>
            <CardTitle>Подключение ВКонтакте</CardTitle>
            <CardDescription>
              Подключите несколько сообществ и свою страницу — отвечайте клиентам с сайта
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <VKInstructions />

            <VKAccountsList
              accounts={accounts}
              onEdit={(acc) => {
                setEditing(acc);
                setFormOpen(true);
              }}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              busyId={busyId}
            />

            {formOpen ? (
              <VKAccountForm
                editing={editing}
                saving={saving}
                onSave={handleSave}
                onCancel={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
              />
            ) : (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Icon name="Plus" size={20} className="mr-2" />
                Добавить подключение
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VKSettings;
