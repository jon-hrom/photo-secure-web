import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface MAXNewChatDialogProps {
  open: boolean;
  newChatPhone: string;
  newChatName: string;
  sending: boolean;
  onOpenChange: (open: boolean) => void;
  onPhoneChange: (phone: string) => void;
  onNameChange: (name: string) => void;
  onCreateChat: () => void;
}

const MAXNewChatDialog = ({
  open,
  newChatPhone,
  newChatName,
  sending,
  onOpenChange,
  onPhoneChange,
  onNameChange,
  onCreateChat,
}: MAXNewChatDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый чат MAX</DialogTitle>
        </DialogHeader>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <Icon name="Info" size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Укажите данные вашего клиента</p>
              <p className="text-xs text-blue-700">Сообщения будут отправлены от вашего имени (с вашего подтверждённого номера из Настроек)</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Номер телефона клиента</Label>
            <Input
              id="phone"
              placeholder="+7 (XXX) XXX-XX-XX"
              value={newChatPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Имя клиента (необязательно)</Label>
            <Input
              id="name"
              placeholder="Анна Смирнова"
              value={newChatName}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0"
            onClick={onCreateChat}
            disabled={sending || !newChatPhone.trim()}
          >
            {sending ? (
              <>
                <Icon name="Loader" size={16} className="mr-2 animate-spin" />
                Создание...
              </>
            ) : (
              <>
                <Icon name="MessageCircle" size={16} className="mr-2" />
                Создать чат
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MAXNewChatDialog;