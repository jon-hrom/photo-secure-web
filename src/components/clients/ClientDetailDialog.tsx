import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import { Client, Project, Payment, Comment } from '@/components/clients/ClientsTypes';
import ClientDetailOverview from '@/components/clients/detail/ClientDetailOverview';
import ClientDetailProjects from '@/components/clients/detail/ClientDetailProjects';
import ClientDetailPayments from '@/components/clients/detail/ClientDetailPayments';
import ClientDetailDocumentsHistory from '@/components/clients/detail/ClientDetailDocumentsHistory';

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
            <ClientDetailOverview
              projects={projects}
              payments={payments}
              comments={comments}
              newComment={newComment}
              setNewComment={setNewComment}
              handleAddComment={handleAddComment}
              handleDeleteComment={handleDeleteComment}
              formatDateTime={formatDateTime}
            />
          </TabsContent>

          <TabsContent value="projects" className="space-y-4 mt-4">
            <ClientDetailProjects
              projects={projects}
              newProject={newProject}
              setNewProject={setNewProject}
              handleAddProject={handleAddProject}
              handleDeleteProject={handleDeleteProject}
              updateProjectStatus={updateProjectStatus}
              getStatusBadge={getStatusBadge}
              formatDate={formatDate}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <ClientDetailDocumentsHistory
              documents={documents}
              messages={messages}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              tab="documents"
            />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4">
            <ClientDetailPayments
              payments={payments}
              newPayment={newPayment}
              setNewPayment={setNewPayment}
              handleAddPayment={handleAddPayment}
              handleDeletePayment={handleDeletePayment}
              getPaymentStatusBadge={getPaymentStatusBadge}
              formatDate={formatDate}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <ClientDetailDocumentsHistory
              documents={documents}
              messages={messages}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              tab="history"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailDialog;