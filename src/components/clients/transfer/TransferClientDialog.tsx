import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Client, Project } from '@/components/clients/ClientsTypes';
import { transferApi } from './transferApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  projects: Project[];
  onTransferred?: () => void;
}

const TransferClientDialog = ({ open, onOpenChange, client, projects, onTransferred }: Props) => {
  const [lookupType, setLookupType] = useState<'email' | 'phone'>('email');
  const [lookupValue, setLookupValue] = useState('');
  const [scope, setScope] = useState<'client' | 'project'>('client');
  const [projectId, setProjectId] = useState<string>('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'cancelled'),
    [projects]
  );

  const canSubmit =
    !loading &&
    lookupValue.trim().length > 3 &&
    (scope === 'client' || (scope === 'project' && projectId));

  const reset = () => {
    setLookupValue('');
    setComment('');
    setScope('client');
    setProjectId('');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await transferApi.create({
        scope,
        client_id: Number(client.id),
        project_id: scope === 'project' ? Number(projectId) : undefined,
        lookup_type: lookupType,
        lookup_value: lookupValue.trim(),
        comment: comment.trim() || undefined,
      });

      const target = scope === 'project'
        ? `проект «${activeProjects.find(p => String(p.id) === projectId)?.name || ''}»`
        : `клиента «${client.name}»`;

      if (result.recipient_found) {
        toast.success(`Передача отправлена`, {
          description: `Фотограф получит уведомление и сможет принять ${target}. Уведомление: ${result.invite_sent_via.toUpperCase()}`,
          duration: 9000,
        });
      } else {
        toast.info('Приглашение отправлено', {
          description: `Этот фотограф ещё не в системе. Мы отправили приглашение через ${result.invite_sent_via}. Как только зарегистрируется — получит ${target}.`,
          duration: 11000,
        });
      }

      reset();
      onOpenChange(false);
      onTransferred?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось отправить';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Send" size={20} className="text-primary shrink-0" />
            <span>Передать другому фотографу</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm break-words">
            Клиент: <b>{client.name}</b>. Получатель сможет принять или отказаться.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Что передать?</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as 'client' | 'project')}>
              <div className="flex items-start gap-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setScope('client')}>
                <RadioGroupItem value="client" id="scope-client" className="mt-1" />
                <Label htmlFor="scope-client" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Всю карточку клиента</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Со всеми проектами, фото, перепиской, оплатами и документами. У вас клиент исчезнет.
                  </div>
                </Label>
              </div>
              <div className="flex items-start gap-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setScope('project')}>
                <RadioGroupItem value="project" id="scope-project" className="mt-1" />
                <Label htmlFor="scope-project" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Только один проект</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Клиент останется у вас, переедет только выбранный проект.
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {scope === 'project' && (
            <div className="space-y-2">
              <Label htmlFor="project-select">Выберите проект</Label>
              <select
                id="project-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— выбрать —</option>
                {activeProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {activeProjects.length === 0 && (
                <p className="text-xs text-muted-foreground">У клиента нет активных проектов</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Контакт получателя</Label>
            <Tabs value={lookupType} onValueChange={(v) => setLookupType(v as 'email' | 'phone')}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="email"><Icon name="Mail" size={14} className="mr-1" /> Email</TabsTrigger>
                <TabsTrigger value="phone"><Icon name="Phone" size={14} className="mr-1" /> Телефон</TabsTrigger>
              </TabsList>
              <TabsContent value="email" className="mt-2">
                <Input
                  type="email"
                  placeholder="photographer@example.com"
                  value={lookupValue}
                  onChange={(e) => setLookupValue(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="phone" className="mt-2">
                <Input
                  type="tel"
                  placeholder="+7 999 123-45-67"
                  value={lookupValue}
                  onChange={(e) => setLookupValue(e.target.value)}
                />
              </TabsContent>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              Если фотограф не в системе — отправим приглашение через MAX/email.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Сообщение получателю (необязательно)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Например: «Перенаправляю клиента, не успеваю в дату съёмки»"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full sm:w-auto">
            <Icon name={loading ? 'Loader2' : 'Send'} size={16} className={`mr-2${loading ? ' animate-spin' : ''}`} />
            {loading ? 'Отправляем...' : 'Отправить передачу'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferClientDialog;