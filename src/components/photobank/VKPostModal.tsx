import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const VK_POST_API = 'https://functions.poehali.dev/3a680e97-242d-4947-a2ee-778e1066cdf3';

interface VKPostModalProps {
  open: boolean;
  onClose: () => void;
  photoUrls: string[];
  userId: string;
}

const VKPostModal = ({ open, onClose, photoUrls, userId }: VKPostModalProps) => {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'group' | 'personal'>('group');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!message.trim() && photoUrls.length === 0) {
      toast.error('Добавьте текст или выберите фото');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch(VK_POST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          message: message.trim(),
          photo_urls: photoUrls.slice(0, 10),
          target,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.link ? 'Опубликовано в ВКонтакте!' : 'Запись создана',
          { description: data.link, action: data.link ? { label: 'Открыть', onClick: () => window.open(data.link, '_blank') } : undefined }
        );
        setMessage('');
        onClose();
      } else {
        toast.error(data.error || 'Не удалось опубликовать');
      }
    } catch {
      toast.error('Ошибка при публикации');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Share2" size={20} className="text-blue-600" />
            Публикация в ВКонтакте
          </DialogTitle>
          <DialogDescription>
            Будет создан пост{photoUrls.length > 0 ? ` с ${photoUrls.length} фото` : ''} (до 10 фото).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Куда опубликовать</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={target === 'group' ? 'default' : 'outline'}
                onClick={() => setTarget('group')}
                className={target === 'group' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                <Icon name="Users" size={16} className="mr-2" />
                В сообщество
              </Button>
              <Button
                type="button"
                variant={target === 'personal' ? 'default' : 'outline'}
                onClick={() => setTarget('personal')}
                className={target === 'personal' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                <Icon name="User" size={16} className="mr-2" />
                На страницу
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vk-post-text">Текст записи</Label>
            <Textarea
              id="vk-post-text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Напишите текст поста..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={posting}>
            Отмена
          </Button>
          <Button onClick={handlePost} disabled={posting} className="bg-blue-600 hover:bg-blue-700">
            {posting ? (
              <>
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                Публикуем...
              </>
            ) : (
              <>
                <Icon name="Send" size={16} className="mr-2" />
                Опубликовать
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VKPostModal;
