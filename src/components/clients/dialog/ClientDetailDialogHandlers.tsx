import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Client, Project, Payment, Comment, Message, Booking } from '@/components/clients/ClientsTypes';

export const useClientDetailHandlers = (
  localClient: Client,
  projects: Project[],
  payments: Payment[],
  comments: Comment[],
  messages: Message[],
  newProject: any,
  setNewProject: (project: any) => void,
  newPayment: any,
  setNewPayment: (payment: any) => void,
  newComment: string,
  setNewComment: (comment: string) => void,
  newMessage: any,
  setNewMessage: (message: any) => void,
  onUpdate: (client: Client) => void
) => {
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

    const allPayments = [...payments, ...newPayments];
    
    const updatedProjects = projects.map(project => {
      const projectPayments = allPayments.filter(p => p.projectId === project.id);
      const totalPaid = projectPayments.reduce((sum, p) => sum + p.amount, 0);
      
      if (totalPaid >= project.budget && project.status === 'new') {
        return { ...project, status: 'in_progress' as const };
      }
      
      return project;
    });

    const updatedClient = {
      ...localClient,
      payments: allPayments,
      projects: updatedProjects,
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
    
    const projectsMovedToProgress = updatedProjects.filter((p, idx) => 
      p.status === 'in_progress' && projects[idx]?.status === 'new'
    );
    
    if (newPayments.length > 1) {
      toast.success(`Создано ${newPayments.length} платежей на общую сумму ${totalAmount.toLocaleString('ru-RU')} ₽`);
    } else {
      toast.success('Платёж добавлен');
    }
    
    if (projectsMovedToProgress.length > 0) {
      toast.success(`${projectsMovedToProgress.length} проект(а) переведены в работу`);
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

  const handleAddMessage = () => {
    if (!newMessage.content.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }

    const message: Message = {
      id: Date.now(),
      date: new Date().toISOString(),
      content: newMessage.content,
      type: newMessage.type as 'phone' | 'whatsapp' | 'telegram' | 'viber',
      author: newMessage.author || 'Фотограф',
    };

    const updatedClient = {
      ...localClient,
      messages: [...messages, message],
    };

    onUpdate(updatedClient);
    setNewMessage({ content: '', type: 'phone', author: newMessage.author });
    toast.success('Сообщение добавлено');
  };

  const handleDeleteProject = (projectId: number) => {
    const updatedClient = {
      ...localClient,
      projects: projects.filter(p => p.id !== projectId),
      payments: payments.filter(p => p.projectId !== projectId),
    };
    onUpdate(updatedClient);
    toast.success('Услуга удалена');
  };

  const handleDeletePayment = (paymentId: number) => {
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

  const handleDeleteMessage = (messageId: number) => {
    const updatedClient = {
      ...localClient,
      messages: messages.filter(m => m.id !== messageId),
    };
    onUpdate(updatedClient);
    toast.success('Сообщение удалено');
  };

  const updateProjectStatus = (projectId: number, status: Project['status']) => {
    const updatedProjects = projects.map(p =>
      p.id === projectId ? { ...p, status } : p
    );
    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
    };
    onUpdate(updatedClient);
    toast.success('Статус изменён');
  };

  const updateProjectDate = (projectId: number, newDate: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id === projectId) {
        const oldDate = p.startDate;
        const dateHistory = p.dateHistory || [];
        
        dateHistory.push({
          oldDate,
          newDate,
          changedAt: new Date().toISOString(),
        });

        return {
          ...p,
          startDate: newDate,
          dateHistory,
        };
      }
      return p;
    });

    const updatedBookings = localClient.bookings.map(b => {
      if (b.title === projects.find(p => p.id === projectId)?.name) {
        return {
          ...b,
          booking_date: newDate,
          date: new Date(newDate),
        };
      }
      return b;
    });

    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
      bookings: updatedBookings,
    };

    onUpdate(updatedClient);
    toast.success('Дата проекта изменена');
  };

  const handleDocumentUploaded = (document: any) => {
    const updatedClient = {
      ...localClient,
      documents: [...localClient.documents, document],
    };
    onUpdate(updatedClient);
  };

  const handleDocumentDeleted = (documentId: number) => {
    const updatedClient = {
      ...localClient,
      documents: localClient.documents.filter(d => d.id !== documentId),
    };
    onUpdate(updatedClient);
  };

  const markProjectAsCompleted = (projectId: number) => {
    const updatedProjects = projects.map(p =>
      p.id === projectId 
        ? { 
            ...p, 
            status: 'completed' as const,
            photoDownloadedAt: new Date().toISOString(),
            endDate: new Date().toISOString()
          } 
        : p
    );

    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
    };

    onUpdate(updatedClient);
    toast.success('Проект завершён и перемещён в неактивные');
  };

  const getStatusBadge = (status: Project['status']) => {
    const statusConfig = {
      new: { label: 'Новый', variant: 'default' as const },
      in_progress: { label: 'В работе', variant: 'secondary' as const },
      completed: { label: 'Завершён', variant: 'outline' as const },
      cancelled: { label: 'Отменён', variant: 'destructive' as const },
    };
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentStatusBadge = (status: Payment['status']) => {
    const statusConfig = {
      pending: { label: 'Ожидает', variant: 'secondary' as const },
      completed: { label: 'Оплачено', variant: 'default' as const },
      cancelled: { label: 'Отменено', variant: 'destructive' as const },
    };
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return {
    handleAddProject,
    handleAddPayment,
    handleAddComment,
    handleAddMessage,
    handleDeleteProject,
    handleDeletePayment,
    handleDeleteComment,
    handleDeleteMessage,
    updateProjectStatus,
    updateProjectDate,
    handleDocumentUploaded,
    handleDocumentDeleted,
    markProjectAsCompleted,
    getStatusBadge,
    getPaymentStatusBadge,
    formatDate,
    formatDateTime,
  };
};