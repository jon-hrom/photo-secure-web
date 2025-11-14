import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface Project {
  id: number;
  name: string;
  status: 'new' | 'in_progress' | 'completed' | 'cancelled';
  budget: number;
  startDate: string;
  endDate?: string;
  description: string;
}

interface Document {
  id: number;
  name: string;
  type: 'contract' | 'specification' | 'invoice' | 'other';
  uploadDate: string;
  url: string;
  notes?: string;
}

interface Payment {
  id: number;
  amount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  method: 'card' | 'cash' | 'transfer';
  description: string;
  projectId?: number;
}

interface Message {
  id: number;
  date: string;
  type: 'email' | 'vk' | 'phone' | 'meeting';
  content: string;
  author: string;
}

interface Comment {
  id: number;
  date: string;
  author: string;
  text: string;
}

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  vkProfile?: string;
  projects?: Project[];
  documents?: Document[];
  payments?: Payment[];
  messages?: Message[];
  comments?: Comment[];
}

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: (client: Client) => void;
}

const ClientDetailDialog = ({ open, onOpenChange, client, onUpdate }: ClientDetailDialogProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [newProject, setNewProject] = useState({ name: '', budget: '', description: '' });
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'card', description: '' });
  const [newComment, setNewComment] = useState('');

  if (!client) return null;

  const projects = client.projects || [];
  const documents = client.documents || [];
  const payments = client.payments || [];
  const messages = client.messages || [];
  const comments = client.comments || [];

  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  const handleAddProject = () => {
    if (!newProject.name || !newProject.budget) {
      toast.error('Заполните название и бюджет проекта');
      return;
    }

    const project: Project = {
      id: Date.now(),
      name: newProject.name,
      status: 'new',
      budget: parseFloat(newProject.budget),
      startDate: new Date().toISOString(),
      description: newProject.description,
    };

    const updatedClient = {
      ...client,
      projects: [...projects, project],
    };

    onUpdate(updatedClient);
    setNewProject({ name: '', budget: '', description: '' });
    toast.success('Проект добавлен');
  };

  const handleAddPayment = () => {
    if (!newPayment.amount) {
      toast.error('Укажите сумму платежа');
      return;
    }

    const payment: Payment = {
      id: Date.now(),
      amount: parseFloat(newPayment.amount),
      date: new Date().toISOString(),
      status: 'completed',
      method: newPayment.method as 'card' | 'cash' | 'transfer',
      description: newPayment.description,
    };

    const updatedClient = {
      ...client,
      payments: [...payments, payment],
    };

    onUpdate(updatedClient);
    setNewPayment({ amount: '', method: 'card', description: '' });
    toast.success('Платёж добавлен');
  };

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast.error('Введите текст комментария');
      return;
    }

    const comment: Comment = {
      id: Date.now(),
      date: new Date().toISOString(),
      author: 'Администратор',
      text: newComment,
    };

    const updatedClient = {
      ...client,
      comments: [...comments, comment],
    };

    onUpdate(updatedClient);
    setNewComment('');
    toast.success('Комментарий добавлен');
  };

  const handleDeleteProject = (projectId: number) => {
    if (!confirm('Удалить проект?')) return;
    
    const updatedClient = {
      ...client,
      projects: projects.filter(p => p.id !== projectId),
    };
    onUpdate(updatedClient);
    toast.success('Проект удалён');
  };

  const handleDeletePayment = (paymentId: number) => {
    if (!confirm('Удалить платёж?')) return;
    
    const updatedClient = {
      ...client,
      payments: payments.filter(p => p.id !== paymentId),
    };
    onUpdate(updatedClient);
    toast.success('Платёж удалён');
  };

  const handleDeleteComment = (commentId: number) => {
    const updatedClient = {
      ...client,
      comments: comments.filter(c => c.id !== commentId),
    };
    onUpdate(updatedClient);
    toast.success('Комментарий удалён');
  };

  const updateProjectStatus = (projectId: number, status: Project['status']) => {
    const updatedClient = {
      ...client,
      projects: projects.map(p => p.id === projectId ? { ...p, status } : p),
    };
    onUpdate(updatedClient);
    toast.success('Статус проекта обновлён');
  };

  const getStatusBadge = (status: Project['status']) => {
    const variants = {
      new: { label: 'Новый', color: 'bg-blue-100 text-blue-800' },
      in_progress: { label: 'В работе', color: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Завершён', color: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-800' },
    };
    const v = variants[status];
    return <Badge className={v.color}>{v.label}</Badge>;
  };

  const getPaymentStatusBadge = (status: Payment['status']) => {
    const variants = {
      pending: { label: 'Ожидает', color: 'bg-orange-100 text-orange-800' },
      completed: { label: 'Оплачен', color: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-800' },
    };
    const v = variants[status];
    return <Badge className={v.color}>{v.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Icon name="User" size={28} className="text-primary" />
            {client.name}
          </DialogTitle>
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Icon name="Phone" size={14} />
              {client.phone}
            </div>
            {client.email && (
              <div className="flex items-center gap-1">
                <Icon name="Mail" size={14} />
                {client.email}
              </div>
            )}
            {client.vkProfile && (
              <div className="flex items-center gap-1">
                <Icon name="MessageCircle" size={14} />
                @{client.vkProfile}
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">
              <Icon name="LayoutDashboard" size={16} className="mr-2" />
              Обзор
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Icon name="Briefcase" size={16} className="mr-2" />
              Проекты
            </TabsTrigger>
            <TabsTrigger value="documents">
              <Icon name="FileText" size={16} className="mr-2" />
              Документы
            </TabsTrigger>
            <TabsTrigger value="payments">
              <Icon name="DollarSign" size={16} className="mr-2" />
              Оплаты
            </TabsTrigger>
            <TabsTrigger value="history">
              <Icon name="History" size={16} className="mr-2" />
              История
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Icon name="Briefcase" size={16} className="text-blue-500" />
                    Проектов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projects.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Общий бюджет: {totalBudget.toLocaleString('ru-RU')} ₽
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Icon name="DollarSign" size={16} className="text-green-500" />
                    Оплачено
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {totalPaid.toLocaleString('ru-RU')} ₽
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Платежей: {payments.filter(p => p.status === 'completed').length}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Icon name="Clock" size={16} className="text-orange-500" />
                    Ожидает оплаты
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {totalPending.toLocaleString('ru-RU')} ₽
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Платежей: {payments.filter(p => p.status === 'pending').length}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon name="MessageSquare" size={18} />
                    Комментарии
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Добавить комментарий..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={handleAddComment} size="sm">
                    <Icon name="Plus" size={16} className="mr-2" />
                    Добавить комментарий
                  </Button>
                </div>

                {comments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Комментариев пока нет
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {comments.slice().reverse().map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.author}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(comment.date)}
                              </span>
                            </div>
                            <p className="text-sm">{comment.text}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Icon name="Trash2" size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Добавить новый проект</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Название проекта *</Label>
                    <Input
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="Свадебная фотосессия"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Бюджет (₽) *</Label>
                    <Input
                      type="number"
                      value={newProject.budget}
                      onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                      placeholder="50000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Детали проекта..."
                    rows={2}
                  />
                </div>
                <Button onClick={handleAddProject}>
                  <Icon name="Plus" size={16} className="mr-2" />
                  Создать проект
                </Button>
              </CardContent>
            </Card>

            {projects.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Проектов пока нет
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Card key={project.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {project.name}
                            {getStatusBadge(project.status)}
                          </CardTitle>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Бюджет: {project.budget.toLocaleString('ru-RU')} ₽</span>
                            <span>Начало: {formatDate(project.startDate)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Icon name="Trash2" size={16} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {project.description && (
                        <p className="text-sm text-muted-foreground">{project.description}</p>
                      )}
                      <div className="flex gap-2">
                        <Select
                          value={project.status}
                          onValueChange={(value) => updateProjectStatus(project.id, value as Project['status'])}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Новый</SelectItem>
                            <SelectItem value="in_progress">В работе</SelectItem>
                            <SelectItem value="completed">Завершён</SelectItem>
                            <SelectItem value="cancelled">Отменён</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Документы</CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8">
                    <Icon name="FileText" size={48} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Документов пока нет</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Здесь будут храниться договоры, ТЗ и другие документы
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon name="FileText" size={20} className="text-primary" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.uploadDate)}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Icon name="Download" size={16} className="mr-2" />
                          Скачать
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Добавить платёж</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Сумма (₽) *</Label>
                    <Input
                      type="number"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                      placeholder="10000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Способ оплаты</Label>
                    <Select
                      value={newPayment.method}
                      onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">Карта</SelectItem>
                        <SelectItem value="cash">Наличные</SelectItem>
                        <SelectItem value="transfer">Перевод</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Input
                      value={newPayment.description}
                      onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                      placeholder="Предоплата 50%"
                    />
                  </div>
                </div>
                <Button onClick={handleAddPayment}>
                  <Icon name="Plus" size={16} className="mr-2" />
                  Добавить платёж
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>История платежей</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Платежей пока нет
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payments.slice().reverse().map((payment) => (
                      <div key={payment.id} className="border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg">
                              {payment.amount.toLocaleString('ru-RU')} ₽
                            </span>
                            {getPaymentStatusBadge(payment.status)}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{formatDate(payment.date)}</span>
                            <span>•</span>
                            <span>
                              {payment.method === 'card' && 'Карта'}
                              {payment.method === 'cash' && 'Наличные'}
                              {payment.method === 'transfer' && 'Перевод'}
                            </span>
                            {payment.description && (
                              <>
                                <span>•</span>
                                <span>{payment.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
                        >
                          <Icon name="Trash2" size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>История взаимодействий</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <Icon name="History" size={48} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">История пуста</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Здесь будет отображаться история общения с клиентом
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className="border rounded-lg p-3">
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
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(msg.date)}
                          </span>
                        </div>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailDialog;
