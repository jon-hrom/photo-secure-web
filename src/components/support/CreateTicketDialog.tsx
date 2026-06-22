import { useState, useRef } from 'react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  createTicket, fileToAttachment, RequestType, Priority,
  NewAttachment, Ticket,
} from './supportTicketsApi';

interface CreateTicketDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string | number;
  userName?: string;
  userEmail?: string;
  onCreated: (ticket: Ticket) => void;
}

const TYPE_OPTIONS: { value: RequestType; label: string; icon: string }[] = [
  { value: 'question', label: 'Вопрос', icon: 'CircleHelp' },
  { value: 'problem', label: 'Проблема', icon: 'TriangleAlert' },
  { value: 'suggestion', label: 'Предложение', icon: 'Lightbulb' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; icon: string; color: string }[] = [
  { value: 'low', label: 'Низкий', icon: 'Check', color: 'text-green-500' },
  { value: 'normal', label: 'Обычный', icon: 'Circle', color: 'text-blue-500' },
  { value: 'high', label: 'Высокий', icon: 'CircleAlert', color: 'text-orange-500' },
  { value: 'urgent', label: 'Срочный', icon: 'Flame', color: 'text-red-500' },
];

const PLACEHOLDERS: Record<RequestType, string> = {
  question: 'Опишите ваш вопрос как можно подробнее.\n\nЕсли есть скриншот или фото — прикрепите ниже, так будет проще разобраться.',
  problem: 'Подробно опишите проблему. Укажите дату и время, когда она возникла.\n\nПрикрепите скриншот или фото экрана — это поможет быстрее найти причину.',
  suggestion: 'Расскажите о вашей идее: что именно хотите улучшить.\n\nМожно прикрепить референс или скриншот для наглядности.',
};

export default function CreateTicketDialog({ open, onClose, userId, userName, userEmail, onCreated }: CreateTicketDialogProps) {
  const [requestType, setRequestType] = useState<RequestType>('question');
  const [priority, setPriority] = useState<Priority>('normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<{ att: NewAttachment; preview: string }[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRequestType('question');
    setPriority('normal');
    setSubject('');
    setMessage('');
    setAttachments([]);
  };

  const handleClose = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 6 - attachments.length);
    for (const file of arr) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`Файл «${file.name}» больше 8 МБ`);
        continue;
      }
      const att = await fileToAttachment(file);
      setAttachments(prev => [...prev, { att, preview: att.data }]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error('Укажите тему обращения');
      return;
    }
    if (!message.trim() && attachments.length === 0) {
      toast.error('Опишите ваш вопрос');
      return;
    }
    setSending(true);
    try {
      const res = await createTicket(userId, {
        request_type: requestType,
        priority,
        subject: subject.trim(),
        message: message.trim(),
        user_name: userName,
        user_email: userEmail,
        attachments: attachments.map(a => a.att),
      });
      if (res.success && res.ticket) {
        toast.success('Обращение создано');
        reset();
        onCreated(res.ticket);
      } else {
        toast.error(res.error || 'Не удалось создать обращение');
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[80] bg-black/80" />
        <DialogPrimitive.Content
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-[80] grid w-full max-w-[calc(100%-1.5rem)] sm:max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-5 sm:p-6 shadow-lg sm:rounded-lg max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
            <Icon name="X" size={18} />
            <span className="sr-only">Закрыть</span>
          </DialogPrimitive.Close>
        {/* Тип запроса */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Тип запроса</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = requestType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRequestType(opt.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 px-1 text-sm font-medium transition-all ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon name={opt.icon} size={16} className="shrink-0" />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Приоритет */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Приоритет</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRIORITY_OPTIONS.map((opt) => {
              const active = priority === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 px-1 text-sm font-medium transition-all ${
                    active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon name={opt.icon} size={16} className={`shrink-0 ${opt.color}`} />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Тема */}
        <Input
          placeholder="Тема обращения"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />

        {/* Сообщение */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={PLACEHOLDERS[requestType]}
          rows={5}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Превью вложений */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border group">
                {a.att.type.startsWith('image/') ? (
                  <img src={a.preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-muted">
                    <Icon name="File" size={20} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                >
                  <Icon name="X" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Низ: прикрепить / отменить / отправить */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ImagePlus" size={18} />
            <span>Прикрепить файл</span>
            {attachments.length > 0 && (
              <span className="text-xs text-primary font-medium">{attachments.length}/6</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={sending}>Отменить</Button>
            <Button onClick={handleSubmit} disabled={sending}>
              {sending ? <Icon name="Loader2" size={16} className="animate-spin" /> : 'Отправить'}
            </Button>
          </div>
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}