import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Message, Booking, Project, Payment, Client } from '@/components/clients/ClientsTypes';
import ProjectArchiveDialog from '@/components/clients/ProjectArchiveDialog';

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
                    className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-white hover:shadow-lg transition-all cursor-pointer"
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
                  <div key={`message-${msg.id}`} className="border rounded-lg p-3 bg-white">
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