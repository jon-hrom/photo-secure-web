import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Client, Project, Payment, Comment, Message, Booking } from '@/components/clients/ClientsTypes';
import ClientDialogHeader from '@/components/clients/dialog/ClientDialogHeader';
import ClientDialogTabs from '@/components/clients/dialog/ClientDialogTabs';
import ClientDialogContent from '@/components/clients/dialog/ClientDialogContent';

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: (client: Client) => void;
}

const ClientDetailDialog = ({ open, onOpenChange, client, onUpdate }: ClientDetailDialogProps) => {
  const tabs = ['overview', 'projects', 'documents', 'payments', 'messages', 'history'] as const;
  const [activeTab, setActiveTab] = useState('overview');
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [photographerPhone, setPhotographerPhone] = useState('');
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
  const [newMessage, setNewMessage] = useState({ 
    content: '', 
    type: 'phone', 
    author: '' 
  });
  const [localClient, setLocalClient] = useState(client);

  useEffect(() => {
    const fetchPhotographerPhone = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        
        const SETTINGS_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';
        const response = await fetch(`${SETTINGS_API}?userId=${userId}`);
        const data = await response.json();
        
        if (response.ok && data.phone) {
          setPhotographerPhone(data.phone);
          setNewMessage(prev => ({ ...prev, author: data.phone }));
        }
      } catch (error) {
        console.error('[ClientDetailDialog] Failed to fetch photographer phone:', error);
      }
    };
    
    fetchPhotographerPhone();
  }, []);

  useEffect(() => {
    if (client) {
      console.log('[ClientDetailDialog] Client updated:', client);
      console.log('[ClientDetailDialog] Payments:', client.payments?.length);
      console.log('[ClientDetailDialog] Projects:', client.projects?.length);
      console.log('[ClientDetailDialog] Messages:', client.messages?.length);
      setLocalClient(client);
    }
  }, [client]);

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

    // Если указана дата бронирования, создаём/обновляем запись
    const updatedBookings = [...localClient.bookings];
    if (newProject.startDate) {
      const bookingDate = new Date(newProject.startDate);
      const booking: Booking = {
        id: Date.now() + 1,
        date: bookingDate,
        booking_date: newProject.startDate,
        booking_time: '10:00',
        time: '10:00',
        title: newProject.name,
        description: newProject.description || `Бронирование для проекта: ${newProject.name}`,
        notificationEnabled: false,
        notification_enabled: false,
        notificationTime: 60,
        notification_time: 60,
        clientId: localClient.id,
        client_id: localClient.id,
      };
      updatedBookings.push(booking);
    }

    const updatedClient = {
      ...localClient,
      projects: [...projects, project],
      bookings: updatedBookings,
    };

    onUpdate(updatedClient);
    setNewProject({ 
      name: '', 
      budget: '', 
      description: '',
      startDate: new Date().toISOString().split('T')[0]
    });
    toast.success('Услуга добавлена' + (newProject.startDate ? ' и создана запись' : ''));
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
      
      projectsNeedingPayment.forEach((item, index) => {
        const proportion = item.remaining / totalRemaining;
        const paymentAmount = index === projectsNeedingPayment.length - 1 
          ? totalAmount - newPayments.reduce((sum, p) => sum + p.amount, 0)
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

  const handleAddMessage = () => {
    if (!newMessage.content.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }

    console.log('[handleAddMessage] Adding message:', newMessage);

    const message: Message = {
      id: Date.now(),
      date: new Date().toISOString(),
      type: 'phone',
      author: photographerPhone || 'Фотограф',
      content: newMessage.content,
    };

    const updatedClient = {
      ...localClient,
      messages: [...messages, message],
    };

    console.log('[handleAddMessage] Updated client messages:', updatedClient.messages.length);

    // Сначала обновляем локальное состояние для мгновенной реакции
    setLocalClient(updatedClient);
    
    // Затем сохраняем на сервере
    onUpdate(updatedClient);
    
    // Очищаем форму
    setNewMessage({ content: '', type: 'phone', author: photographerPhone });
    toast.success('Сообщение отправлено');
  };

  const handleDeleteMessage = (messageId: number) => {
    const updatedClient = {
      ...localClient,
      messages: messages.filter(m => m.id !== messageId),
    };
    onUpdate(updatedClient);
    toast.success('Сообщение удалено');
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

  const updateProjectDate = (projectId: number, newDate: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const oldDate = new Date(project.startDate).toISOString().split('T')[0];
    
    // Обновляем дату проекта
    const updatedProjects = projects.map(p => 
      p.id === projectId ? { ...p, startDate: new Date(newDate).toISOString() } : p
    );

    // Создаём новую запись с новой датой
    const newBooking: Booking = {
      id: Date.now(),
      date: new Date(newDate),
      booking_date: newDate,
      booking_time: '10:00',
      time: '10:00',
      title: project.name,
      description: `Перенесено с ${new Date(oldDate).toLocaleDateString('ru-RU')}. ${project.description || ''}`,
      notificationEnabled: false,
      notification_enabled: false,
      notificationTime: 60,
      notification_time: 60,
      clientId: localClient.id,
      client_id: localClient.id,
    };

    // Старая запись автоматически уйдёт в историю (дата в прошлом)
    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
      bookings: [...localClient.bookings, newBooking],
    };

    onUpdate(updatedClient);
    toast.success(`Дата изменена. Старая запись сохранена в истории`);
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
        <ClientDialogHeader client={localClient} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <ClientDialogTabs activeTab={activeTab} />

          <ClientDialogContent
            localClient={localClient}
            projects={projects}
            documents={documents}
            payments={payments}
            messages={messages}
            comments={comments}
            newProject={newProject}
            setNewProject={setNewProject}
            handleAddProject={handleAddProject}
            handleDeleteProject={handleDeleteProject}
            updateProjectStatus={updateProjectStatus}
            updateProjectDate={updateProjectDate}
            getStatusBadge={getStatusBadge}
            formatDate={formatDate}
            newPayment={newPayment}
            setNewPayment={setNewPayment}
            handleAddPayment={handleAddPayment}
            handleDeletePayment={handleDeletePayment}
            getPaymentStatusBadge={getPaymentStatusBadge}
            newComment={newComment}
            setNewComment={setNewComment}
            handleAddComment={handleAddComment}
            handleDeleteComment={handleDeleteComment}
            formatDateTime={formatDateTime}
            handleDocumentUploaded={handleDocumentUploaded}
            handleDocumentDeleted={handleDocumentDeleted}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleAddMessage={handleAddMessage}
            handleDeleteMessage={handleDeleteMessage}
            showSwipeHint={showSwipeHint}
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailDialog;