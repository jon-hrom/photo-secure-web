import { useState, useEffect } from 'react';
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
import SwipeContainer from '@/components/layout/SwipeContainer';
import { formatPhoneNumber } from '@/utils/phoneFormat';

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: (client: Client) => void;
}

const ClientDetailDialog = ({ open, onOpenChange, client, onUpdate }: ClientDetailDialogProps) => {
  const tabs = ['overview', 'projects', 'documents', 'payments', 'history'] as const;
  const [activeTab, setActiveTab] = useState('overview');
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [newProject, setNewProject] = useState({ 
    name: '', 
    budget: '', 
    description: '',
    startDate: new Date().toISOString().split('T')[0]
  });
  const [newPayment, setNewPayment] = useState({ 
    amount: '', 
    method: 'card', 
    description: '', 
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    splitAcrossProjects: false
  });
  const [newComment, setNewComment] = useState('');
  const [localClient, setLocalClient] = useState(client);

  // Обновляем локального клиента при изменении пропса
  useEffect(() => {
    if (client) {
      console.log('[ClientDetailDialog] Client updated:', client);
      console.log('[ClientDetailDialog] Payments in updated client:', client.payments);
      console.log('[ClientDetailDialog] Projects in updated client:', client.projects);
      setLocalClient(client);
    }
  }, [client]);

  // Показываем подсказку при первом открытии
  useEffect(() => {
    if (open) {
      const hasSeenHint = localStorage.getItem('clientDetailSwipeHintSeen');
      if (!hasSeenHint) {
        setShowSwipeHint(true);
        setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem('clientDetailSwipeHintSeen', 'true');
        }, 3500);
      }
    }
  }, [open]);

  if (!localClient) return null;

  const projects = localClient.projects || [];
  const documents = localClient.documents || [];
  const payments = localClient.payments || [];
  const messages = localClient.messages || [];
  const comments = localClient.comments || [];

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
      startDate: new Date(newProject.startDate).toISOString(),
      description: newProject.description,
    };

    const updatedClient = {
      ...localClient,
      projects: [...projects, project],
    };

    onUpdate(updatedClient);
    setNewProject({ 
      name: '', 
      budget: '', 
      description: '',
      startDate: new Date().toISOString().split('T')[0]
    });
    toast.success('Услуга добавлена');
  };

  const handleAddPayment = () => {
    if (!newPayment.amount) {
      toast.error('Укажите сумму платежа');
      return;
    }

    if (!newPayment.splitAcrossProjects && !newPayment.projectId) {
      toast.error('Выберите проект');
      return;
    }

    const paymentDate = newPayment.date ? new Date(newPayment.date) : new Date();
    const totalAmount = parseFloat(newPayment.amount);
    
    let newPayments: Payment[] = [];

    if (newPayment.splitAcrossProjects && projects.length > 0) {
      // Распределяем оплату на все проекты с недостающей суммой
      const projectsNeedingPayment = projects.map(project => {
        const projectPayments = payments.filter(p => p.projectId === project.id);
        const totalPaid = projectPayments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = project.budget - totalPaid;
        return { project, remaining: Math.max(0, remaining) };
      }).filter(p => p.remaining > 0);

      if (projectsNeedingPayment.length === 0) {
        toast.error('Все проекты полностью оплачены');
        return;
      }

      const totalRemaining = projectsNeedingPayment.reduce((sum, p) => sum + p.remaining, 0);
      
      // Распределяем пропорционально недостающим суммам
      projectsNeedingPayment.forEach((item, index) => {
        const proportion = item.remaining / totalRemaining;
        const paymentAmount = index === projectsNeedingPayment.length - 1 
          ? totalAmount - newPayments.reduce((sum, p) => sum + p.amount, 0) // Последний платеж - остаток
          : Math.round(totalAmount * proportion * 100) / 100;

        newPayments.push({
          id: Date.now() + index,
          amount: paymentAmount,
          date: paymentDate.toISOString(),
          status: 'completed',
          method: newPayment.method as 'card' | 'cash' | 'transfer',
          description: `${newPayment.description || 'Оплата'} (распределено)`,
          projectId: item.project.id,
        });
      });

      console.log('[ClientDetailDialog] Split payments across projects:', newPayments);
    } else {
      // Обычный платеж для одного проекта
      newPayments = [{
        id: Date.now(),
        amount: totalAmount,
        date: paymentDate.toISOString(),
        status: 'completed',
        method: newPayment.method as 'card' | 'cash' | 'transfer',
        description: newPayment.description,
        projectId: parseInt(newPayment.projectId),
      }];
    }

    const updatedClient = {
      ...localClient,
      payments: [...payments, ...newPayments],
    };

    onUpdate(updatedClient);
    setNewPayment({ 
      amount: '', 
      method: 'card', 
      description: '', 
      projectId: '',
      date: new Date().toISOString().split('T')[0],
      splitAcrossProjects: false
    });
    
    if (newPayments.length > 1) {
      toast.success(`Создано ${newPayments.length} платежей на общую сумму ${totalAmount.toLocaleString('ru-RU')} ₽`);
    } else {
      toast.success('Платёж добавлен');
    }
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
      ...localClient,
      comments: [...comments, comment],
    };

    onUpdate(updatedClient);
    setNewComment('');
    toast.success('Комментарий добавлен');
  };

  const handleDeleteProject = (projectId: number) => {
    if (!confirm('Удалить проект?')) return;
    
    const updatedClient = {
      ...localClient,
      projects: projects.filter(p => p.id !== projectId),
    };
    onUpdate(updatedClient);
    toast.success('Проект удалён');
  };

  const handleDeletePayment = (paymentId: number) => {
    if (!confirm('Удалить платёж?')) return;
    
    const updatedClient = {
      ...localClient,
      payments: payments.filter(p => p.id !== paymentId),
    };
    onUpdate(updatedClient);
    toast.success('Платёж удалён');
  };

  const handleDeleteComment = (commentId: number) => {
    const updatedClient = {
      ...localClient,
      comments: comments.filter(c => c.id !== commentId),
    };
    onUpdate(updatedClient);
    toast.success('Комментарий удалён');
  };

  const handleDocumentUploaded = (document: any) => {
    console.log('[ClientDetailDialog] Document uploaded:', document);
    console.log('[ClientDetailDialog] Current documents:', documents);
    
    const updatedClient = {
      ...localClient,
      documents: [...documents, document],
    };
    
    console.log('[ClientDetailDialog] Updated client documents:', updatedClient.documents);
    onUpdate(updatedClient);
  };

  const handleDocumentDeleted = (documentId: number) => {
    const updatedClient = {
      ...localClient,
      documents: documents.filter(d => d.id !== documentId),
    };
    onUpdate(updatedClient);
  };

  const updateProjectStatus = (projectId: number, status: Project['status']) => {
    const updatedClient = {
      ...localClient,
      projects: projects.map(p => p.id === projectId ? { ...p, status } : p),
    };
    onUpdate(updatedClient);
    toast.success('Статус проекта обновлён');
  };

  const getStatusBadge = (status: Project['status']) => {
    const variants = {
      new: { label: 'Новый', color: 'bg-green-100 text-green-800' },
      in_progress: { label: 'В работе', color: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Завершён', color: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'Отменён', color: 'bg-gray-100 text-gray-800' },
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
    if (!dateString) return 'Дата не указана';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Некорректная дата';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'Дата не указана';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Некорректная дата';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 sm:gap-3 text-xl sm:text-2xl">
            <Icon name="User" size={24} className="text-primary sm:w-7 sm:h-7" />
            <span className="truncate">{localClient.name}</span>
          </DialogTitle>
          <div className="flex flex-wrap gap-2 mt-2 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Icon name="Phone" size={14} />
              <span className="truncate">{formatPhoneNumber(localClient.phone)}</span>
            </div>
            {localClient.email && (
              <div className="flex items-center gap-1">
                <Icon name="Mail" size={14} />
                <span className="truncate">{localClient.email}</span>
              </div>
            )}
            {localClient.vkProfile && (
              <div className="flex items-center gap-1">
                <Icon name="MessageCircle" size={14} />
                <span className="truncate">@{localClient.vkProfile}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-5 w-full h-auto">
            <TabsTrigger value="overview" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
              <Icon name="LayoutDashboard" size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Обзор</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
              <Icon name="Briefcase" size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Проекты</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
              <Icon name="FileText" size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Документы</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
              <Icon name="DollarSign" size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Оплаты</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
              <Icon name="History" size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">История</span>
            </TabsTrigger>
          </TabsList>

          <div className="relative overflow-hidden">
            {showSwipeHint && (
              <>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 animate-in slide-in-from-left-4 fade-in duration-700 lg:hidden">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg">
                    <Icon name="ChevronLeft" size={20} />
                    <span className="text-sm font-medium">Свайпните</span>
                  </div>
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 animate-in slide-in-from-right-4 fade-in duration-700 lg:hidden">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 rounded-full shadow-lg">
                    <span className="text-sm font-medium">для навигации</span>
                    <Icon name="ChevronRight" size={20} />
                  </div>
                </div>
              </>
            )}
            <SwipeContainer
              onSwipeLeft={() => {
                const currentIndex = tabs.indexOf(activeTab as any);
                if (currentIndex < tabs.length - 1) {
                  setActiveTab(tabs[currentIndex + 1]);
                }
              }}
              onSwipeRight={() => {
                const currentIndex = tabs.indexOf(activeTab as any);
                if (currentIndex > 0) {
                  setActiveTab(tabs[currentIndex - 1]);
                }
              }}
            >

          <TabsContent value="overview" className="space-y-4 mt-4 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
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

          <TabsContent value="projects" className="space-y-4 mt-4 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
            <ClientDetailProjects
              projects={projects}
              payments={payments}
              newProject={newProject}
              setNewProject={setNewProject}
              handleAddProject={handleAddProject}
              handleDeleteProject={handleDeleteProject}
              updateProjectStatus={updateProjectStatus}
              getStatusBadge={getStatusBadge}
              formatDate={formatDate}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
            <ClientDetailDocumentsHistory
              documents={documents}
              messages={messages}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              tab="documents"
              clientId={localClient.id}
              onDocumentUploaded={handleDocumentUploaded}
              onDocumentDeleted={handleDocumentDeleted}
            />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
            <ClientDetailPayments
              payments={payments}
              projects={projects}
              newPayment={newPayment}
              setNewPayment={setNewPayment}
              handleAddPayment={handleAddPayment}
              handleDeletePayment={handleDeletePayment}
              getPaymentStatusBadge={getPaymentStatusBadge}
              formatDate={formatDate}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
            <ClientDetailDocumentsHistory
              documents={documents}
              messages={messages}
              bookings={localClient.bookings}
              projects={projects}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              tab="history"
              clientId={localClient.id}
              onDocumentUploaded={handleDocumentUploaded}
              onDocumentDeleted={handleDocumentDeleted}
            />
          </TabsContent>

          </SwipeContainer>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailDialog;