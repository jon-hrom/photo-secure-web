import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { IncomingTransfer, transferApi } from './transferApi';
import { formatPhoneNumber } from '@/utils/phoneFormat';

interface Props {
  transfer: IncomingTransfer | null;
  onResolved: () => void;
  onClose: () => void;
}

const IncomingTransferModal = ({ transfer, onResolved, onClose }: Props) => {
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);
  const [appeared, setAppeared] = useState(false);

  // Плавное появление через ~600мс после монтирования
  if (transfer && !appeared) {
    setTimeout(() => setAppeared(true), 50);
  }

  if (!transfer) return null;

  const handleAccept = async () => {
    setLoading('accept');
    try {
      await transferApi.accept(transfer.id, reply.trim() || undefined);
      toast.success('Клиент принят', {
        description: `Все данные перенесены в ваш кабинет. Отправителю отправлено уведомление.`,
        duration: 8000,
      });
      onResolved();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка';
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    try {
      await transferApi.reject(transfer.id, reply.trim() || undefined);
      toast.info('Передача отклонена', {
        description: `Отправителю отправлено уведомление об отказе.`,
        duration: 6000,
      });
      onResolved();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка';
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const handleChat = () => {
    const phone = transfer.sender_phone;
    if (!phone) {
      toast.error('У отправителя не указан телефон');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
  };

  const senderLabel = transfer.sender_name || transfer.sender_email || transfer.sender_phone || 'Фотограф';

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent
        className={`max-w-lg transition-all duration-700 ease-out ${
          appeared ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-full bg-primary/10">
              <Icon name="Inbox" size={22} className="text-primary" />
            </div>
            Вам передают клиента
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <Icon name="UserCircle" size={18} className="text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">От фотографа</div>
                <div className="font-medium">{senderLabel}</div>
                {transfer.sender_phone && (
                  <div className="text-xs text-muted-foreground">{formatPhoneNumber(transfer.sender_phone)}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="User" size={18} className="text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Клиент</div>
                <div className="font-medium">{transfer.client_name_snapshot || '—'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Package" size={18} className="text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Объём</div>
                <div className="font-medium">
                  {transfer.scope === 'client'
                    ? 'Вся карточка клиента (проекты, фото, оплаты, переписка)'
                    : `Только проект: ${transfer.project_name_snapshot || '—'}`}
                </div>
              </div>
            </div>
            {transfer.comment && (
              <div className="flex items-start gap-2 pt-2 border-t">
                <Icon name="MessageSquare" size={18} className="text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Комментарий</div>
                  <div className="text-sm whitespace-pre-wrap">{transfer.comment}</div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply">Ваш ответ (необязательно)</Label>
            <Textarea
              id="reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder="Например: «Принимаю, спасибо!» или «Не смогу, занят в эту дату»"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleChat}
              disabled={!!loading || !transfer.sender_phone}
              className="sm:w-auto"
            >
              <Icon name="MessageCircle" size={16} className="mr-2" />
              Чат с {senderLabel.split(' ')[0]}
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={!!loading}
              className="text-destructive hover:text-destructive"
            >
              <Icon name={loading === 'reject' ? 'Loader2' : 'X'} size={16} className={`mr-2${loading === 'reject' ? ' animate-spin' : ''}`} />
              Отказаться
            </Button>
            <Button onClick={handleAccept} disabled={!!loading}>
              <Icon name={loading === 'accept' ? 'Loader2' : 'Check'} size={16} className={`mr-2${loading === 'accept' ? ' animate-spin' : ''}`} />
              Принять клиента
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingTransferModal;
