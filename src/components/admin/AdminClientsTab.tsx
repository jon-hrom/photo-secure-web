import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Client {
  id: number;
  user_id: string;
  photographer_id: number;
  photographer_email: string;
  photographer_name: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  vk_profile: string;
  shooting_date: string;
  shooting_time: string;
  shooting_duration: number;
  shooting_address: string;
  project_price: number;
  project_comments: string;
  created_at: string;
  updated_at: string;
  stats: {
    projects_count: number;
    payments_count: number;
    documents_count: number;
    bookings_count: number;
    total_paid: number;
  };
}

const ADMIN_CLIENTS_API = 'https://functions.poehali.dev/d96a37c3-e019-4e0f-b3a9-ed6573dbc0c5';

export default function AdminClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    filterClients();
  }, [searchQuery, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId');
      
      const response = await fetch(ADMIN_CLIENTS_API, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || ''
        }
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить клиентов');
      }

      const data = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Ошибка загрузки клиентов');
    } finally {
      setLoading(false);
    }
  };

  const filterClients = () => {
    if (!searchQuery.trim()) {
      setFilteredClients(clients);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = clients.filter(client => 
      client.name?.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.photographer_email?.toLowerCase().includes(query) ||
      client.photographer_name?.toLowerCase().includes(query) ||
      client.address?.toLowerCase().includes(query)
    );
    
    setFilteredClients(filtered);
  };

  const handleDeleteClick = (client: Client) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedClient) return;

    try {
      setDeleting(true);
      const userId = localStorage.getItem('userId');

      const response = await fetch(ADMIN_CLIENTS_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || ''
        },
        body: JSON.stringify({ client_id: selectedClient.id })
      });

      if (!response.ok) {
        throw new Error('Не удалось удалить клиента');
      }

      toast.success('Клиент полностью удалён из базы данных');
      setDeleteDialogOpen(false);
      setSelectedClient(null);
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Ошибка удаления клиента');
    } finally {
      setDeleting(false);
    }
  };

  const toggleRow = (clientId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedRows(newExpanded);
  };

  const groupByPhotographer = () => {
    const grouped = filteredClients.reduce((acc, client) => {
      const key = client.photographer_email || 'Без фотографа';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(client);
      return acc;
    }, {} as Record<string, Client[]>);

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Icon name="Loader2" className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const photographerGroups = groupByPhotographer();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Управление клиентами</h2>
          <p className="text-sm text-muted-foreground">
            Всего клиентов: {clients.length}
          </p>
        </div>
        <Button onClick={loadClients} variant="outline" size="sm">
          <Icon name="RefreshCw" className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, телефону, email, фотографу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-4">
        {photographerGroups.map(([photographerEmail, photographerClients]) => (
          <Collapsible key={photographerEmail} defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="User" className="h-4 w-4" />
                  <span className="font-semibold">{photographerEmail}</span>
                  <Badge variant="secondary">{photographerClients.length}</Badge>
                </div>
                <Icon name="ChevronDown" className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Имя</TableHead>
                      <TableHead>Телефон</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Дата создания</TableHead>
                      <TableHead>Статистика</TableHead>
                      <TableHead className="w-24">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {photographerClients.map((client) => (
                      <>
                        <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell onClick={() => toggleRow(client.id)}>
                            <Icon 
                              name={expandedRows.has(client.id) ? "ChevronDown" : "ChevronRight"} 
                              className="h-4 w-4" 
                            />
                          </TableCell>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>{client.phone}</TableCell>
                          <TableCell>{client.email || '—'}</TableCell>
                          <TableCell>{new Date(client.created_at).toLocaleDateString('ru-RU')}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">
                                <Icon name="FolderOpen" className="h-3 w-3 mr-1" />
                                {client.stats.projects_count}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Icon name="CreditCard" className="h-3 w-3 mr-1" />
                                {client.stats.total_paid.toLocaleString('ru-RU')} ₽
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(client)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Icon name="Trash2" className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        
                        {expandedRows.has(client.id) && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30">
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-semibold text-muted-foreground">Адрес</p>
                                    <p className="text-sm">{client.address || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-muted-foreground">ВКонтакте</p>
                                    <p className="text-sm">{client.vk_profile || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-muted-foreground">Дата съёмки</p>
                                    <p className="text-sm">
                                      {client.shooting_date 
                                        ? new Date(client.shooting_date).toLocaleDateString('ru-RU') 
                                        : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-muted-foreground">Стоимость проекта</p>
                                    <p className="text-sm">
                                      {client.project_price 
                                        ? `${client.project_price.toLocaleString('ru-RU')} ₽` 
                                        : '—'}
                                    </p>
                                  </div>
                                </div>
                                
                                {client.project_comments && (
                                  <div>
                                    <p className="text-sm font-semibold text-muted-foreground">Комментарии</p>
                                    <p className="text-sm">{client.project_comments}</p>
                                  </div>
                                )}

                                <div className="flex gap-4 pt-2">
                                  <div className="flex items-center gap-2">
                                    <Icon name="FileText" className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">Документы: {client.stats.documents_count}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon name="Calendar" className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">Бронирования: {client.stats.bookings_count}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Icon name="DollarSign" className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">Платежи: {client.stats.payments_count}</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {filteredClients.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="Users" className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Клиенты не найдены</p>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить клиента?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите полностью удалить клиента <strong>{selectedClient?.name}</strong> из базы данных?
              <br /><br />
              <strong className="text-destructive">Это действие необратимо!</strong>
              <br />
              Будут удалены все связанные данные:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>{selectedClient?.stats.projects_count || 0} проектов</li>
                <li>{selectedClient?.stats.payments_count || 0} платежей</li>
                <li>{selectedClient?.stats.documents_count || 0} документов</li>
                <li>{selectedClient?.stats.bookings_count || 0} бронирований</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Icon name="Trash2" className="mr-2 h-4 w-4" />
                  Удалить навсегда
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
