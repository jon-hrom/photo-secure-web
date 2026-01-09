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
        <DialogContent className="max-w-md flex flex-col max-h-[90vh] sm:max-h-[85vh] p-0 gap-0" data-tour="client-form" aria-describedby="add-client-description">
          <div className="flex-shrink-0 p-4 sm:p-6 pb-3">
            <DialogHeader>
              <DialogTitle>Новый клиент</DialogTitle>
            </DialogHeader>
            <div id="add-client-description" className="sr-only">
              Форма для добавления нового клиента в базу
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4 px-4 sm:px-6 overflow-y-auto flex-1 min-h-0 pb-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="name" className="text-sm">ФИО *</Label>
              <Input
                id="name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                placeholder="Иванов Иван Иванович"
                className="h-10 text-sm sm:text-base"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="phone" className="text-sm">Телефон *</Label>
              <Input
                id="phone"
                value={newClient.phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setNewClient({ ...newClient, phone: formatted });
                }}
                placeholder="+7 (999) 123-45-67"
                maxLength={18}
                className="h-10 text-sm sm:text-base"
              />
              <p className="text-[11px] sm:text-xs text-muted-foreground">Формат: +7 (999) 123-45-67</p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="example@mail.ru"
                className="h-10 text-sm sm:text-base"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="address" className="text-sm">Адрес</Label>
              <Input
                id="address"
                value={newClient.address}
                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                placeholder="г. Москва, ул. Ленина, д. 1"
                className="h-10 text-sm sm:text-base"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="vk" className="text-sm">ВКонтакте</Label>
              <Input
                id="vk"
                value={newClient.vkProfile}
                onChange={(e) => setNewClient({ ...newClient, vkProfile: e.target.value })}
                placeholder="https://vk.com/username или @username"
                className="h-10 text-sm sm:text-base"
              />
              <p className="text-[11px] sm:text-xs text-muted-foreground">Для поздравлений и сервисных уведомлений</p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="birthdate" className="text-sm">Дата рождения</Label>
              <Input
                id="birthdate"
                type="date"
                value={newClient.birthdate}
                onChange={(e) => setNewClient({ ...newClient, birthdate: e.target.value })}
                className="h-10 text-sm sm:text-base"
              />
              <p className="text-[11px] sm:text-xs text-muted-foreground">Для автоматических поздравлений</p>
            </div>
          </div>
          <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-background">
            <Button 
              onClick={handleAddClientWithCheck} 
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold shadow-md active:scale-[0.98] transition-transform"
              type="button"
            >
              <Icon name="UserPlus" size={18} className="mr-1.5 sm:mr-2" />
              Добавить карточку клиента
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh] sm:max-h-[85vh] p-0 gap-0" aria-describedby="edit-client-description">
          <div className="flex-shrink-0 p-4 sm:p-6 pb-3">
            <DialogHeader>
              <DialogTitle>Редактирование клиента</DialogTitle>
            </DialogHeader>
            <div id="edit-client-description" className="sr-only">
              Форма для редактирования данных клиента
            </div>
          </div>
          {editingClient && (
            <>
              <div className="space-y-3 sm:space-y-4 px-4 sm:px-6 overflow-y-auto flex-1 min-h-0 pb-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="edit-name" className="text-sm">ФИО *</Label>
                  <Input
                    id="edit-name"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                    className="h-10 text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="edit-phone" className="text-sm">Телефон *</Label>
                  <Input
                    id="edit-phone"
                    value={editingClient.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setEditingClient({ ...editingClient, phone: formatted });
                    }}
                    maxLength={18}
                    className="h-10 text-sm sm:text-base"
                  />
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Формат: +7 (999) 123-45-67</p>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="edit-email" className="text-sm">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className="h-10 text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="edit-address" className="text-sm">Адрес</Label>
                  <Input
                    id="edit-address"
                    value={editingClient.address}
                    onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                    className="h-10 text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="edit-vk" className="text-sm">ВКонтакте</Label>
                  <Input
                    id="edit-vk"
                    value={editingClient.vkProfile || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, vkProfile: e.target.value })}
                    placeholder="https://vk.com/username или @username"
                    className="h-10 text-sm sm:text-base"
                  />
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Для поздравлений и сервисных уведомлений</p>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="edit-birthdate" className="text-sm">Дата рождения</Label>
                  <Input
                    id="edit-birthdate"
                    type="date"
                    value={editingClient.birthdate || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, birthdate: e.target.value })}
                    className="h-10 text-sm sm:text-base"
                  />
                  <p className="text-[11px] sm:text-xs text-muted-foreground">Для автоматических поздравлений</p>
                </div>
              </div>
              <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-background">
                <Button 
                  onClick={handleUpdateClient} 
                  className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold shadow-md active:scale-[0.98] transition-transform"
                  type="button"
                >
                  <Icon name="Save" size={18} className="mr-1.5 sm:mr-2" />
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