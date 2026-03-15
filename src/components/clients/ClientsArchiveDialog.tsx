import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';

interface ClientsArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSelectClient: (client: Client) => void;
}

const ClientsArchiveDialog = ({ open, onOpenChange, clients, onSelectClient }: ClientsArchiveDialogProps) => {
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null);

  const archivedClients = clients.filter(client => {
    const projects = client.projects || [];
    if (projects.length === 0) return false;
    return projects.every(p => p.status === 'completed' || p.status === 'cancelled');
  });

  const getClientInitials = (name: string) => {
    const words = name.split(' ');
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'completed') return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Завершён</Badge>;
    if (status === 'cancelled') return <Badge variant="destructive" className="opacity-70">Отменён</Badge>;
    return <Badge>{status}</Badge>;
  };

  const handleOpenClient = (client: Client) => {
    onOpenChange(false);
    setTimeout(() => onSelectClient(client), 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Archive" size={20} />
            Архив клиентов
          </DialogTitle>
        </DialogHeader>

        {archivedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Icon name="ArchiveX" size={48} className="mb-3 opacity-40" />
            <p className="text-lg font-medium">Архив пуст</p>
            <p className="text-sm mt-1">Здесь появятся клиенты, у которых все проекты завершены</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-2">
              <p className="text-sm text-muted-foreground mb-3">
                Клиентов в архиве: <span className="font-semibold text-foreground">{archivedClients.length}</span>
              </p>

              {archivedClients.map(client => {
                const projects = client.projects || [];
                const isExpanded = expandedClientId === client.id;

                return (
                  <div
                    key={client.id}
                    className="border rounded-lg overflow-hidden transition-all"
                  >
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-sm font-bold shrink-0">
                        {getClientInitials(client.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {projects.length} {projects.length === 1 ? 'проект' : projects.length < 5 ? 'проекта' : 'проектов'}
                        </p>
                      </div>
                      <Icon
                        name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                        size={18}
                        className="text-muted-foreground shrink-0"
                      />
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-accent/20 p-3 space-y-2">
                        {client.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Icon name="Phone" size={14} />
                            {client.phone}
                          </p>
                        )}

                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Проекты</p>
                          {projects.map(project => (
                            <div key={project.id} className="flex items-center justify-between gap-2 bg-background/60 rounded-md px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{project.name}</p>
                                {project.startDate && (
                                  <p className="text-xs text-muted-foreground">{formatDate(project.startDate)}</p>
                                )}
                              </div>
                              {getStatusBadge(project.status)}
                            </div>
                          ))}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => handleOpenClient(client)}
                        >
                          <Icon name="ExternalLink" size={14} className="mr-2" />
                          Открыть карточку
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClientsArchiveDialog;
