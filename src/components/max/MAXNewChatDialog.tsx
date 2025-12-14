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
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Номер телефона</Label>
            <Input
              id="phone"
              placeholder="+7 (XXX) XXX-XX-XX"
              value={newChatPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Имя контакта (необязательно)</Label>
            <Input
              id="name"
              placeholder="Иван Иванов"
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
            className="bg-green-600 hover:bg-green-700"
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
