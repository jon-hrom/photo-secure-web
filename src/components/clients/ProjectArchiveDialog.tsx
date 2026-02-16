import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Project, Payment, Client } from '@/components/clients/ClientsTypes';

interface ProjectArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  client: Client;
  payments: Payment[];
}

const ProjectArchiveDialog = ({ open, onOpenChange, project, client, payments }: ProjectArchiveDialogProps) => {
  if (!project) return null;

  const projectPayments = payments.filter(p => p.projectId === project.id && p.status === 'completed');
  const totalPaid = projectPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = project.budget - totalPaid;

  const getStatusBadge = (status: Project['status']) => {
    const variants = {
      new: { label: 'Новый', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      in_progress: { label: 'В работе', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      completed: { label: 'Завершён', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      cancelled: { label: 'Отменён', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300' },
    };
    return <Badge className={variants[status].color}>{variants[status].label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Archive" size={20} />
            Архив проекта
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Информация о клиенте */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Icon name="User" className="text-primary" size={24} />
                <div>
                  <h3 className="font-semibold">{client.name}</h3>
                  <p className="text-sm text-muted-foreground">{client.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Основная информация о проекте */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{project.name}</h3>
                  {getStatusBadge(project.status)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Бюджет</p>
                  <p className="text-lg font-semibold">{project.budget.toLocaleString('ru-RU')} ₽</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Оплачено</p>
                  <p className="text-lg font-semibold text-green-600">{totalPaid.toLocaleString('ru-RU')} ₽</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Осталось</p>
                  <p className="text-lg font-semibold text-orange-600">{remaining.toLocaleString('ru-RU')} ₽</p>
                </div>
              </div>

              {project.description && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Описание</p>
                  <p className="text-sm">{project.description}</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Дата начала</p>
                <p className="text-sm font-medium">
                  {new Date(project.startDate).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* История переносов дат */}
          {project.dateHistory && project.dateHistory.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="CalendarClock" size={16} />
                  История переносов
                </h3>
                <div className="space-y-2">
                  {project.dateHistory.map((history, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                      <Icon name="ArrowRight" size={14} className="text-orange-600" />
                      <span>
                        <span className="line-through text-muted-foreground">
                          {new Date(history.oldDate).toLocaleDateString('ru-RU')}
                        </span>
                        {' → '}
                        <span className="font-medium">
                          {new Date(history.newDate).toLocaleDateString('ru-RU')}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(history.changedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* История платежей */}
          {projectPayments.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon name="DollarSign" size={16} />
                  История платежей
                </h3>
                <div className="space-y-2">
                  {projectPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded">
                      <div className="flex items-center gap-2">
                        <Icon name="CheckCircle" size={16} className="text-green-600" />
                        <div>
                          <p className="text-sm font-medium">{payment.amount.toLocaleString('ru-RU')} ₽</p>
                          {payment.description && (
                            <p className="text-xs text-muted-foreground">{payment.description}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(payment.date).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectArchiveDialog;