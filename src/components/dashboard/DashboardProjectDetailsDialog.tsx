import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Client, Project } from '@/components/clients/ClientsTypes';

interface DashboardProjectDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  project: Project | null;
}

const DashboardProjectDetailsDialog = ({
  open,
  onOpenChange,
  client,
  project
}: DashboardProjectDetailsDialogProps) => {
  if (!client || !project) return null;

  const statusColors = {
    new: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    completed: 'bg-green-500',
    cancelled: 'bg-gray-500'
  };

  const statusLabels = {
    new: 'Новый',
    in_progress: 'В работе',
    completed: 'Завершён',
    cancelled: 'Отменён'
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Briefcase" size={20} className="text-green-600" />
            Проект: {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Клиент */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
            <Icon name="User" size={20} className="text-purple-600" />
            <div>
              <p className="text-sm text-muted-foreground">Клиент</p>
              <p className="font-semibold">{client.name}</p>
            </div>
          </div>

          {/* Статус */}
          <div className="flex items-center gap-3">
            <Icon name="Activity" size={20} className="text-gray-600" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Статус</p>
              <Badge className={`${statusColors[project.status]} text-white mt-1`}>
                {statusLabels[project.status]}
              </Badge>
            </div>
          </div>

          {/* Дата съёмки */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
            <Icon name="Calendar" size={20} className="text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Дата съёмки</p>
              <p className="font-semibold">{formatDate(project.startDate)}</p>
            </div>
          </div>

          {/* Бюджет */}
          {project.budget > 0 && (
            <div className="flex items-center gap-3">
              <Icon name="DollarSign" size={20} className="text-gray-600" />
              <div>
                <p className="text-sm text-muted-foreground">Бюджет</p>
                <p className="font-semibold">{project.budget.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
          )}

          {/* Описание */}
          {project.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="FileText" size={18} className="text-gray-600" />
                <p className="text-sm font-medium">Описание</p>
              </div>
              <p className="text-sm text-muted-foreground pl-7 whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {/* Контакты клиента */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium mb-3">Контакты клиента:</p>
            <div className="space-y-2">
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="Phone" size={16} className="text-gray-600" />
                  <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Icon name="Mail" size={16} className="text-gray-600" />
                  <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                    {client.email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DashboardProjectDetailsDialog;
