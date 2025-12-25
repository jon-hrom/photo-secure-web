import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { useState } from 'react';
import { toast } from 'sonner';

interface ClientDetailShootingProps {
  client: Client;
  onUpdate: (updates: Partial<Client>) => void;
}

const GOOGLE_CALENDAR_API = 'https://functions.poehali.dev/e64a6ed2-e373-426f-aaf5-2d0e53187aa2';

const ClientDetailShooting = ({ client, onUpdate }: ClientDetailShootingProps) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      toast.error('Необходима авторизация');
      return;
    }

    if (!client.shooting_date) {
      toast.error('Заполните дату съёмки');
      return;
    }

    setIsSyncing(true);

    try {
      const method = client.google_event_id ? 'PUT' : 'POST';
      const body = client.google_event_id
        ? {
            client_id: client.id,
            google_event_id: client.google_event_id,
            client_data: {
              name: client.name,
              phone: client.phone,
              email: client.email || '',
              shooting_date: client.shooting_date,
              shooting_time: client.shooting_time || '10:00:00',
              shooting_duration: client.shooting_duration || 2,
              shooting_address: client.shooting_address || '',
              project_price: client.project_price || 0,
              project_comments: client.project_comments || '',
            },
          }
        : {
            client_id: client.id,
            client_data: {
              name: client.name,
              phone: client.phone,
              email: client.email || '',
              shooting_date: client.shooting_date,
              shooting_time: client.shooting_time || '10:00:00',
              shooting_duration: client.shooting_duration || 2,
              shooting_address: client.shooting_address || '',
              project_price: client.project_price || 0,
              project_comments: client.project_comments || '',
            },
          };

      const response = await fetch(GOOGLE_CALENDAR_API, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync');
      }

      const result = await response.json();

      if (result.google_event_id) {
        onUpdate({ google_event_id: result.google_event_id, synced_at: new Date().toISOString() });
      }

      toast.success(client.google_event_id ? 'Событие обновлено в Google Calendar' : 'Событие создано в Google Calendar');
    } catch (error) {
      console.error('[Shooting] Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка синхронизации');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon name="Camera" size={18} />
            Данные съёмки
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={isSyncing || !client.shooting_date}
          >
            <Icon name="Calendar" size={16} className="mr-2" />
            {isSyncing ? 'Синхронизация...' : (client.google_event_id ? 'Обновить в календаре' : 'Добавить в календарь')}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shooting_date" className="flex items-center gap-2">
              <Icon name="Calendar" size={14} />
              Дата съёмки
            </Label>
            <Input
              id="shooting_date"
              type="date"
              value={client.shooting_date || ''}
              onChange={(e) => onUpdate({ shooting_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shooting_time" className="flex items-center gap-2">
              <Icon name="Clock" size={14} />
              Время начала
            </Label>
            <Input
              id="shooting_time"
              type="time"
              value={client.shooting_time || ''}
              onChange={(e) => onUpdate({ shooting_time: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shooting_duration" className="flex items-center gap-2">
              <Icon name="Timer" size={14} />
              Длительность (часы)
            </Label>
            <Input
              id="shooting_duration"
              type="number"
              min="1"
              max="12"
              value={client.shooting_duration || 2}
              onChange={(e) => onUpdate({ shooting_duration: parseInt(e.target.value) || 2 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_price" className="flex items-center gap-2">
              <Icon name="DollarSign" size={14} />
              Стоимость проекта (₽)
            </Label>
            <Input
              id="project_price"
              type="number"
              min="0"
              step="500"
              value={client.project_price || ''}
              onChange={(e) => onUpdate({ project_price: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shooting_address" className="flex items-center gap-2">
            <Icon name="MapPin" size={14} />
            Адрес съёмки
          </Label>
          <Input
            id="shooting_address"
            type="text"
            placeholder="Парк Горького, Москва"
            value={client.shooting_address || ''}
            onChange={(e) => onUpdate({ shooting_address: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project_comments" className="flex items-center gap-2">
            <Icon name="FileText" size={14} />
            Комментарии к проекту
          </Label>
          <Textarea
            id="project_comments"
            rows={4}
            placeholder="Свадьба, 2 образа, ретушь 30 фото..."
            value={client.project_comments || ''}
            onChange={(e) => onUpdate({ project_comments: e.target.value })}
          />
        </div>

        {client.synced_at && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
            <Icon name="CheckCircle" size={14} className="text-green-600" />
            <span>Синхронизировано с Google Calendar: {new Date(client.synced_at).toLocaleString('ru-RU')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientDetailShooting;