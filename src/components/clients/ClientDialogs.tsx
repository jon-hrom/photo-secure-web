import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { toast } from 'sonner';
import { formatPhoneNumber, validatePhone } from '@/utils/phoneFormat';

interface ClientDialogsProps {
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: (open: boolean) => void;
  newClient: {
    name: string;
    phone: string;
    email: string;
    address: string;
    vkProfile: string;
    vkUsername: string;
    birthdate: string;
  };
  setNewClient: (client: any) => void;
  editingClient: Client | null;
  setEditingClient: (client: Client | null) => void;
  handleAddClient: () => void;
  handleUpdateClient: () => void;
  emailVerified: boolean;
  handleOpenAddDialog?: () => void;
  hasUnsavedData?: boolean;
  userId?: string | null;
}

const ClientDialogs = ({
  isAddDialogOpen,
  setIsAddDialogOpen,
  isEditDialogOpen,
  setIsEditDialogOpen,
  newClient,
  setNewClient,
  editingClient,
  setEditingClient,
  handleAddClient,
  handleUpdateClient,
  emailVerified,
  handleOpenAddDialog,
  hasUnsavedData = false,
  userId,
}: ClientDialogsProps) => {
  const handleAddClientWithCheck = () => {
    if (!newClient.name.trim()) {
      toast.error('Укажите ФИО клиента', {
        position: 'top-center',
        duration: 3000,
      });
      return;
    }
    if (!validatePhone(newClient.phone)) {
      toast.error('Телефон должен содержать 11 цифр (включая +7)', {
        position: 'top-center',
        duration: 3000,
      });
      return;
    }
    handleAddClient();
  };
  return (
    <>
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        {!handleOpenAddDialog && (
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-lg hover-scale" data-tour="add-client">
              <Icon name="UserPlus" size={20} className="mr-2" />
              Добавить карточку клиента
            </Button>
          </DialogTrigger>
        )}
        {handleOpenAddDialog && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleOpenAddDialog}
                  className="rounded-full shadow-lg hover-scale relative text-sm md:text-base px-4 md:px-6 h-10 md:h-11" 
                  data-tour="add-client"
                  aria-label={hasUnsavedData ? "Добавить клиента (есть несохранённые данные)" : "Добавить клиента"}
                >
                  {hasUnsavedData && (
                    <span 
                      className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 flex h-3.5 w-3.5 md:h-4 md:w-4 z-10"
                      role="status"
                      aria-label="Индикатор несохранённых данных"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-full w-full bg-orange-500 border-2 border-white shadow-sm"></span>
                    </span>
                  )}
                  <Icon name="UserPlus" size={18} className="mr-1.5 md:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Добавить карточку клиента</span>
                  <span className="sm:hidden whitespace-nowrap">Добавить клиента</span>
                </Button>
              </TooltipTrigger>
              {hasUnsavedData && (
                <TooltipContent side="bottom" className="text-xs max-w-[200px] font-medium bg-orange-500 text-white border-orange-600">
                  <p>Есть несохранённые данные клиента</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}
        <DialogContent className="max-w-md flex flex-col max-h-[85vh]" data-tour="client-form" aria-describedby="add-client-description">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <div id="add-client-description" className="sr-only">
            Форма для добавления нового клиента в базу
          </div>
          <div className="space-y-4 pt-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="name">ФИО *</Label>
              <Input
                id="name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон *</Label>
              <Input
                id="phone"
                value={newClient.phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setNewClient({ ...newClient, phone: formatted });
                }}
                placeholder="+7 (999) 123-45-67"
                maxLength={18}
              />
              <p className="text-xs text-muted-foreground">Формат: +7 (999) 123-45-67</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="example@mail.ru"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Адрес</Label>
              <Input
                id="address"
                value={newClient.address}
                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                placeholder="г. Москва, ул. Ленина, д. 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vk">ВКонтакте (ссылка)</Label>
              <Input
                id="vk"
                value={newClient.vkProfile}
                onChange={(e) => setNewClient({ ...newClient, vkProfile: e.target.value })}
                placeholder="https://vk.com/username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vk-username">ВКонтакте username</Label>
              <Input
                id="vk-username"
                value={newClient.vkUsername}
                onChange={(e) => setNewClient({ ...newClient, vkUsername: e.target.value })}
                placeholder="@username"
              />
              <p className="text-xs text-muted-foreground">Для отправки поздравлений в ЛС</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthdate">Дата рождения</Label>
              <Input
                id="birthdate"
                type="date"
                value={newClient.birthdate}
                onChange={(e) => setNewClient({ ...newClient, birthdate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Для автоматических поздравлений</p>
            </div>
          </div>
          <div className="pt-4 pb-2 border-t mt-4 sticky bottom-0 bg-background">
            <Button 
              onClick={handleAddClientWithCheck} 
              className="w-full h-12 text-base font-semibold shadow-lg active:scale-95 transition-transform cursor-pointer touch-manipulation"
              type="button"
            >
              <Icon name="UserPlus" size={20} className="mr-2" />
              Добавить карточку клиента
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md flex flex-col max-h-[85vh]" aria-describedby="edit-client-description">
          <DialogHeader>
            <DialogTitle>Редактирование клиента</DialogTitle>
          </DialogHeader>
          <div id="edit-client-description" className="sr-only">
            Форма для редактирования данных клиента
          </div>
          {editingClient && (
            <>
              <div className="space-y-4 pt-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">ФИО *</Label>
                  <Input
                    id="edit-name"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Телефон *</Label>
                  <Input
                    id="edit-phone"
                    value={editingClient.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setEditingClient({ ...editingClient, phone: formatted });
                    }}
                    maxLength={18}
                  />
                  <p className="text-xs text-muted-foreground">Формат: +7 (999) 123-45-67</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Адрес</Label>
                  <Input
                    id="edit-address"
                    value={editingClient.address}
                    onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vk">ВКонтакте (ссылка)</Label>
                  <Input
                    id="edit-vk"
                    value={editingClient.vkProfile || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, vkProfile: e.target.value })}
                    placeholder="https://vk.com/username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vk-username">ВКонтакте username</Label>
                  <Input
                    id="edit-vk-username"
                    value={editingClient.vk_username || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, vk_username: e.target.value })}
                    placeholder="@username"
                  />
                  <p className="text-xs text-muted-foreground">Для отправки поздравлений в ЛС</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-birthdate">Дата рождения</Label>
                  <Input
                    id="edit-birthdate"
                    type="date"
                    value={editingClient.birthdate || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, birthdate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Для автоматических поздравлений</p>
                </div>
              </div>
              <div className="pt-4 pb-2 border-t mt-4 sticky bottom-0 bg-background">
                <Button 
                  onClick={handleUpdateClient} 
                  className="w-full h-12 text-base font-semibold shadow-lg active:scale-95 transition-transform cursor-pointer touch-manipulation"
                  type="button"
                >
                  <Icon name="Save" size={20} className="mr-2" />
                  Сохранить изменения
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientDialogs;