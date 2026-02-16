import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Message, Booking, Project, Payment, Client } from '@/components/clients/ClientsTypes';
import ProjectArchiveDialog from '@/components/clients/ProjectArchiveDialog';
import { formatLocalDate } from '@/utils/dateFormat';

const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';

interface ReminderLog {
  id: number;
  project_id: number;
  project_name: string;
  reminder_type: string;
  sent_to: string;
  sent_at: string;
  channel: string;
  success: boolean;
  error_message: string | null;
}

interface MessageHistoryProps {
  messages: Message[];
  bookings: Booking[];
  projects?: Project[];
  payments?: Payment[];
  client: Client;
  formatDateTime: (dateString: string) => string;
}

const MessageHistory = ({ messages, bookings, projects = [], payments = [], client, formatDateTime }: MessageHistoryProps) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);

  useEffect(() => {
    if (!client?.id) return;
    const loadReminders = async () => {
      setLoadingReminders(true);
      try {
        const userId = localStorage.getItem('userId');
        const res = await fetch(CLIENTS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
          body: JSON.stringify({ action: 'get_reminders_log', clientId: client.id })
        });
        const data = await res.json();
        if (data.reminders) setReminders(data.reminders);
      } catch (e) {
        console.error('[RemindersLog] Error:', e);
      } finally {
        setLoadingReminders(false);
      }
    };
    loadReminders();
  }, [client?.id]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastBookings = bookings
    .filter(b => {
      const bookingDate = new Date(b.booking_date || b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return bookingDate < today;
    })
    .sort((a, b) => {
      const dateA = new Date(a.booking_date || a.date);
      const dateB = new Date(b.booking_date || b.date);
      return dateB.getTime() - dateA.getTime();
    });

  const completedOrCancelledProjects = projects.filter(
    p => p.status === 'completed' || p.status === 'cancelled'
  );

  const allHistoryItems = [
    ...completedOrCancelledProjects.map(p => ({
      type: 'project' as const,
      date: p.startDate,
      data: p,
    })),
    ...pastBookings.map(b => ({
      type: 'booking' as const,
      date: b.booking_date || b.date.toISOString(),
      data: b,
    })),
    ...messages.map(m => ({
      type: 'message' as const,
      date: m.date,
      data: m,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setArchiveDialogOpen(true);
  };

  return (
    <>
      {completedOrCancelledProjects.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Archive" size={20} />
              Архив проектов
              <Badge variant="secondary" className="ml-2">{completedOrCancelledProjects.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="hidden md:table-header-group">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Услуга</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Дата съёмки</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Дата завершения</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Статус</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrCancelledProjects
                    .sort((a, b) => new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime())
                    .map((project) => {
                      const projectPayments = payments.filter(p => p.projectId === project.id && p.status === 'completed');
                      const totalPaid = projectPayments.reduce((sum, p) => sum + p.amount, 0);
                      
                      return (
                        <tr 
                          key={`archive-${project.id}`}
                          onClick={() => handleProjectClick(project)}
                          className="border-b hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          {/* Desktop версия */}
                          <td className="hidden md:table-cell py-3 px-3">
                            <div className="font-medium">{project.name}</div>
                            {project.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{project.description}</div>
                            )}
                          </td>
                          <td className="hidden md:table-cell py-3 px-3 text-sm">
                            {formatLocalDate(project.startDate, 'date')}
                          </td>
                          <td className="hidden md:table-cell py-3 px-3 text-sm">
                            {project.endDate 
                              ? formatLocalDate(project.endDate, 'date')
                              : '—'
                            }
                          </td>
                          <td className="hidden md:table-cell py-3 px-3">
                            <Badge 
                              variant={project.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {project.status === 'completed' ? '✓ Завершён' : '✗ Отменён'}
                            </Badge>
                          </td>
                          <td className="hidden md:table-cell py-3 px-3 text-sm">
                            <div className="font-medium">{project.budget.toLocaleString('ru-RU')} ₽</div>
                            {totalPaid > 0 && (
                              <div className="text-xs text-green-600">Оплачено: {totalPaid.toLocaleString('ru-RU')} ₽</div>
                            )}
                          </td>
                          
                          {/* Mobile версия - карточка */}
                          <td className="md:hidden py-3 px-3" colSpan={5}>
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-medium">{project.name}</div>
                                <Badge 
                                  variant={project.status === 'completed' ? 'default' : 'secondary'}
                                  className="text-xs shrink-0"
                                >
                                  {project.status === 'completed' ? '✓ Завершён' : '✗ Отменён'}
                                </Badge>
                              </div>
                              {project.description && (
                                <div className="text-xs text-muted-foreground">{project.description}</div>
                              )}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-muted-foreground">Дата съёмки:</div>
                                  <div className="font-medium">
                                    {new Date(project.startDate).toLocaleDateString('ru-RU', { 
                                      day: 'numeric', 
                                      month: 'short', 
                                      year: 'numeric' 
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Завершён:</div>
                                  <div className="font-medium">
                                    {project.endDate 
                                      ? new Date(project.endDate).toLocaleDateString('ru-RU', { 
                                          day: 'numeric', 
                                          month: 'short', 
                                          year: 'numeric' 
                                        })
                                      : '—'
                                    }
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t">
                                <div className="font-medium text-sm">{project.budget.toLocaleString('ru-RU')} ₽</div>
                                {totalPaid > 0 && (
                                  <div className="text-xs text-green-600">Оплачено: {totalPaid.toLocaleString('ru-RU')} ₽</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {reminders.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Bell" size={20} />
              Отправленные напоминания
              <Badge variant="secondary" className="ml-2">{reminders.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders.map((r) => {
              const typeLabels: Record<string, string> = { '24h': 'За 24 часа', '5h': 'За 5 часов', '1h': 'За 1 час' };
              const channelLabels: Record<string, string> = { both: 'Все каналы', whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'Email' };
              const sentDate = new Date(r.sent_at);
              return (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${r.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <Icon name={r.success ? 'CheckCircle' : 'XCircle'} size={18} className={r.success ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{r.project_name}</span>
                      <Badge variant="outline" className="text-xs">{typeLabels[r.reminder_type] || r.reminder_type}</Badge>
                      <Badge variant="secondary" className="text-xs">{channelLabels[r.channel] || r.channel}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {sentDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                      в {sentDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {r.error_message && (
                      <div className="text-xs text-red-500 mt-1">{r.error_message}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {loadingReminders && (
        <div className="text-center py-4 text-muted-foreground text-sm">Загрузка напоминаний...</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>История взаимодействий</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allHistoryItems.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="History" size={48} className="mx-auto text-muted-foreground dark:text-gray-500 mb-3" />
              <p className="text-muted-foreground dark:text-gray-400">История пуста</p>
              <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
                Здесь будет отображаться история проектов, встреч и общения с клиентом
              </p>
            </div>
          ) : (
            allHistoryItems.map((item, index) => {
              if (item.type === 'project') {
                const project = item.data as Project;
                const projectPayments = payments.filter(p => p.projectId === project.id && p.status === 'completed');
                const totalPaid = projectPayments.reduce((sum, p) => sum + p.amount, 0);
                const hasDateChanges = project.dateHistory && project.dateHistory.length > 0;

                return (
                  <div
                    key={`project-${project.id}`}
                    onClick={() => handleProjectClick(project)}
                    className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/30 dark:to-card hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                          <Icon name="Briefcase" size={20} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">{project.name}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant={project.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                {project.status === 'completed' ? 'Завершён' : 'Отменён'}
                              </Badge>
                              {hasDateChanges && (
                                <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
                                  <Icon name="CalendarClock" size={12} className="mr-1" />
                                  Дата переносилась
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Icon name="ChevronRight" size={20} className="text-muted-foreground dark:text-gray-400" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground dark:text-gray-400">Дата:</span>
                            <span className="ml-1 font-medium">
                              {new Date(project.startDate).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground dark:text-gray-400">Бюджет:</span>
                            <span className="ml-1 font-medium">{project.budget.toLocaleString('ru-RU')} ₽</span>
                          </div>
                        </div>
                        {totalPaid > 0 && (
                          <div className="text-sm mt-2">
                            <span className="text-muted-foreground dark:text-gray-400">Оплачено:</span>
                            <span className="ml-1 font-medium text-green-600">{totalPaid.toLocaleString('ru-RU')} ₽</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              if (item.type === 'message') {
                const msg = item.data as Message;
                return (
                  <div key={`message-${msg.id}`} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon
                        name={
                          msg.type === 'email' ? 'Mail' :
                          msg.type === 'vk' ? 'MessageCircle' :
                          msg.type === 'phone' ? 'Phone' : 'Users'
                        }
                        size={16}
                        className="text-primary"
                      />
                      <span className="text-sm font-medium">{msg.author}</span>
                      <span className="text-xs text-muted-foreground dark:text-gray-400 ml-auto">
                        {formatDateTime(msg.date)}
                      </span>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                );
              }

              return null;
            })
          )}
        </CardContent>
      </Card>

      <ProjectArchiveDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        project={selectedProject}
        client={client}
        payments={payments}
      />
    </>
  );
};

export default MessageHistory;