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
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Icon name="Briefcase" size={18} className="text-green-600 sm:w-5 sm:h-5" />
            <span className="line-clamp-2">Проект: {project.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Клиент */}
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg">
            <Icon name="User" size={18} className="text-purple-600 dark:text-purple-400 sm:w-5 sm:h-5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Клиент</p>
              <p className="font-semibold text-sm sm:text-base truncate text-foreground">{client.name}</p>
            </div>
          </div>

          {/* Статус */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Icon name="Activity" size={18} className="text-gray-600 dark:text-gray-400 sm:w-5 sm:h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground">Статус</p>
              <Badge className={`${statusColors[project.status]} text-white mt-1 text-xs`}>
                {statusLabels[project.status]}
              </Badge>
            </div>
          </div>

          {/* Дата съёмки */}
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg">
            <Icon name="Calendar" size={18} className="text-green-600 dark:text-green-400 sm:w-5 sm:h-5 flex-shrink-0" />
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Дата съёмки</p>
              <p className="font-semibold text-sm sm:text-base text-foreground">{formatDate(project.startDate)}</p>
            </div>
          </div>

          {/* Бюджет */}
          {project.budget > 0 && (
            <div className="flex items-center gap-2 sm:gap-3">
              <Icon name="DollarSign" size={18} className="text-gray-600 dark:text-gray-400 sm:w-5 sm:h-5 flex-shrink-0" />
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Бюджет</p>
                <p className="font-semibold text-sm sm:text-base text-foreground">{project.budget.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
          )}

          {/* Описание */}
          {project.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="FileText" size={16} className="text-gray-600 dark:text-gray-400 sm:w-[18px] sm:h-[18px] flex-shrink-0" />
                <p className="text-xs sm:text-sm font-medium text-foreground">Описание</p>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground pl-6 sm:pl-7 whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {/* Контакты клиента */}
          <div className="border-t dark:border-gray-700 pt-3 sm:pt-4 space-y-2">
            <p className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 text-foreground">Контакты клиента:</p>
            <div className="space-y-2">
              {client.phone && (
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Icon name="Phone" size={14} className="text-gray-600 dark:text-gray-400 sm:w-4 sm:h-4 flex-shrink-0" />
                  <a href={`tel:${client.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Icon name="Mail" size={14} className="text-gray-600 dark:text-gray-400 sm:w-4 sm:h-4 flex-shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-blue-600 dark:text-blue-400 hover:underline truncate">
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