import { toast } from 'sonner';
import { Client, Project, Payment, Comment, Message, Booking } from '@/components/clients/ClientsTypes';
import { sendProjectNotification } from './NotificationService';
import { Badge } from '@/components/ui/badge';

export const createAddProjectHandler = (
  localClient: Client,
  projects: Project[],
  newProject: any,
  setNewProject: (project: any) => void,
  onUpdate: (client: Client) => void,
  photographerName: string
) => {
  return async () => {
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
      shootingStyleId: newProject.shootingStyleId,
    };

    const updatedBookings = [...localClient.bookings];
    if (newProject.startDate) {
      const bookingDate = new Date(newProject.startDate);
      const booking: Booking = {
        id: Date.now() + 1,
        date: bookingDate,
        booking_date: newProject.startDate,
        booking_time: newProject.shooting_time || '10:00',
        time: newProject.shooting_time || '10:00',
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

    // Sync with Google Calendar if requested
    if (newProject.add_to_calendar && newProject.startDate) {
      try {
        const CALENDAR_API = 'https://functions.poehali.dev/calendar-sync';
        const userId = localStorage.getItem('userId');
        
        const response = await fetch(CALENDAR_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId || ''
          },
          body: JSON.stringify({
            project_id: project.id,
            name: newProject.name,
            description: newProject.description,
            start_date: newProject.startDate,
            shooting_time: newProject.shooting_time,
            shooting_duration: newProject.shooting_duration || 2,
            shooting_address: newProject.shooting_address,
            client_name: localClient.name,
            client_phone: localClient.phone
          })
        });

        if (response.ok) {
          toast.success('Проект добавлен в Google Calendar');
        } else {
          const error = await response.json();
          toast.error(`Не удалось добавить в календарь: ${error.error}`);
        }
      } catch (error) {
        console.error('Calendar sync error:', error);
        toast.error('Ошибка синхронизации с календарём');
      }
    }

    setNewProject({ 
      name: '', 
      budget: '', 
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      shootingStyleId: '',
      shooting_time: '10:00',
      shooting_duration: 2,
      shooting_address: '',
      add_to_calendar: false
    });
    toast.success('Услуга добавлена' + (newProject.startDate ? ' и создана запись' : ''));

    await sendProjectNotification(localClient, project, photographerName);
  };
};

export const createAddPaymentHandler = (
  localClient: Client,
  projects: Project[],
  payments: Payment[],
  newPayment: any,
  setNewPayment: (payment: any) => void,
  onUpdate: (client: Client) => void
) => {
  return () => {
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
    
    const newPayments: Payment[] = [];

    if (newPayment.splitAcrossProjects && projects.length > 0) {
      const projectsNeedingPayment = projects.map(project => {
        const projectPayments = payments.filter(p => p.projectId === project.id);
        const paidAmount = projectPayments.reduce((sum, p) => sum + p.amount, 0);
        const remainingAmount = project.budget - paidAmount;
        return { project, remainingAmount };
      }).filter(p => p.remainingAmount > 0);

      if (projectsNeedingPayment.length === 0) {
        toast.error('Все услуги полностью оплачены');
        return;
      }

      const totalRemaining = projectsNeedingPayment.reduce((sum, p) => sum + p.remainingAmount, 0);

      if (totalAmount > totalRemaining) {
        toast.error(`Сумма платежа (${totalAmount.toLocaleString('ru-RU')} ₽) превышает остаток по всем услугам (${totalRemaining.toLocaleString('ru-RU')} ₽)`);
        return;
      }

      projectsNeedingPayment.forEach(({ project }) => {
        const projectShare = (project.budget / totalRemaining) * totalAmount;
        
        const payment: Payment = {
          id: Date.now() + Math.random(),
          projectId: project.id,
          amount: Math.round(projectShare * 100) / 100,
          date: paymentDate.toISOString(),
          method: newPayment.method || 'cash',
          status: 'completed',
          description: '',
        };
        newPayments.push(payment);
      });
    } else {
      const selectedProject = projects.find(p => p.id === parseInt(newPayment.projectId));
      
      if (!selectedProject) {
        toast.error('Выбранная услуга не найдена');
        return;
      }

      const projectPayments = payments.filter(p => p.projectId === selectedProject.id);
      const paidAmount = projectPayments.reduce((sum, p) => sum + p.amount, 0);
      const remainingAmount = selectedProject.budget - paidAmount;

      if (totalAmount > remainingAmount) {
        toast.error(`Сумма платежа (${totalAmount.toLocaleString('ru-RU')} ₽) превышает остаток по услуге (${remainingAmount.toLocaleString('ru-RU')} ₽)`);
        return;
      }

      const payment: Payment = {
        id: Date.now(),
        projectId: newPayment.projectId,
        amount: totalAmount,
        date: paymentDate.toISOString(),
        method: newPayment.method || 'cash',
        status: 'completed',
        description: '',
      };
      newPayments.push(payment);
    }

    const updatedClient = {
      ...localClient,
      payments: [...payments, ...newPayments],
    };

    onUpdate(updatedClient);
    setNewPayment({ 
      projectId: '', 
      amount: '', 
      method: 'cash', 
      date: new Date().toISOString().split('T')[0],
      splitAcrossProjects: false
    });
    toast.success('Платёж добавлен');
  };
};

export const createAddCommentHandler = (
  localClient: Client,
  comments: Comment[],
  newComment: string,
  setNewComment: (comment: string) => void,
  onUpdate: (client: Client) => void
) => {
  return () => {
    if (!newComment.trim()) {
      toast.error('Введите комментарий');
      return;
    }

    const comment: Comment = {
      id: Date.now(),
      text: newComment,
      date: new Date().toISOString(),
      author: 'Фотограф',
    };

    const updatedClient = {
      ...localClient,
      comments: [...comments, comment],
    };

    onUpdate(updatedClient);
    setNewComment('');
    toast.success('Комментарий добавлен');
  };
};

export const createAddMessageHandler = (
  localClient: Client,
  messages: Message[],
  newMessage: any,
  setNewMessage: (message: any) => void,
  onUpdate: (client: Client) => void
) => {
  return () => {
    if (!newMessage.text.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }

    const message: Message = {
      id: Date.now(),
      content: newMessage.text,
      date: new Date().toISOString(),
      type: newMessage.type || 'email',
      author: 'Фотограф',
    };

    const updatedClient = {
      ...localClient,
      messages: [...messages, message],
    };

    onUpdate(updatedClient);
    setNewMessage({ text: '', type: 'email' });
    toast.success('Сообщение добавлено');
  };
};

export const createUpdateProjectHandler = (
  localClient: Client,
  projects: Project[],
  onUpdate: (client: Client) => void
) => {
  return (projectId: number, updates: Partial<Project>) => {
    const updatedProjects = projects.map(p =>
      p.id === projectId ? { ...p, ...updates } : p
    );

    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
    };

    onUpdate(updatedClient);
  };
};

export const createDeleteProjectHandler = (
  localClient: Client,
  projects: Project[],
  payments: Payment[],
  onUpdate: (client: Client) => void
) => {
  return async (projectId: number) => {
    // Удаляем из Google Calendar перед удалением проекта
    try {
      const CALENDAR_API = 'https://functions.poehali.dev/fc049737-8d51-4e98-95e4-c1dd7f6e6c2c';
      const userId = localStorage.getItem('userId');
      
      await fetch(CALENDAR_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || ''
        },
        body: JSON.stringify({ project_id: projectId })
      });
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
    }
    
    const updatedProjects = projects.filter(p => p.id !== projectId);
    const updatedPayments = payments.filter(p => p.projectId !== projectId);

    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
      payments: updatedPayments,
    };

    onUpdate(updatedClient);
    toast.success('Проект удалён');
  };
};

export const createDeletePaymentHandler = (
  localClient: Client,
  payments: Payment[],
  onUpdate: (client: Client) => void
) => {
  return (paymentId: number) => {
    const updatedPayments = payments.filter(p => p.id !== paymentId);

    const updatedClient = {
      ...localClient,
      payments: updatedPayments,
    };

    onUpdate(updatedClient);
    toast.success('Платёж удалён');
  };
};

export const createDeleteCommentHandler = (
  localClient: Client,
  comments: Comment[],
  onUpdate: (client: Client) => void
) => {
  return (commentId: number) => {
    const updatedComments = comments.filter(c => c.id !== commentId);

    const updatedClient = {
      ...localClient,
      comments: updatedComments,
    };

    onUpdate(updatedClient);
    toast.success('Комментарий удалён');
  };
};

export const createDeleteMessageHandler = (
  localClient: Client,
  messages: Message[],
  onUpdate: (client: Client) => void
) => {
  return (messageId: number) => {
    const updatedMessages = messages.filter(m => m.id !== messageId);

    const updatedClient = {
      ...localClient,
      messages: updatedMessages,
    };

    onUpdate(updatedClient);
    toast.success('Сообщение удалено');
  };
};

export const createStatusBadgeGetter = () => {
  return (status: 'new' | 'in_progress' | 'completed' | 'cancelled') => {
    const statusConfig = {
      'new': { label: 'Новый', variant: 'default' as const },
      'in_progress': { label: 'В работе', variant: 'default' as const },
      'completed': { label: 'Завершён', variant: 'default' as const },
      'cancelled': { label: 'Отменён', variant: 'destructive' as const },
    };
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
};

export const createPaymentStatusBadgeGetter = () => {
  return (status: 'pending' | 'completed' | 'cancelled') => {
    const statusConfig = {
      'pending': { label: 'Ожидается', variant: 'secondary' as const },
      'completed': { label: 'Оплачен', variant: 'default' as const },
      'cancelled': { label: 'Отменён', variant: 'destructive' as const },
    };
    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
};

export const createUpdateProjectStatusHandler = (
  localClient: Client,
  projects: Project[],
  onUpdate: (client: Client) => void
) => {
  return async (projectId: number, status: Project['status']) => {
    const project = projects.find(p => p.id === projectId);
    
    // Если проект завершён или отменён, удаляем из Google Calendar
    if (project && (status === 'completed' || status === 'cancelled')) {
      try {
        const CALENDAR_API = 'https://functions.poehali.dev/fc049737-8d51-4e98-95e4-c1dd7f6e6c2c';
        const userId = localStorage.getItem('userId');
        
        await fetch(CALENDAR_API, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId || ''
          },
          body: JSON.stringify({ project_id: projectId })
        });
        
        toast.success('Событие удалено из календаря');
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
      }
    }
    
    const updatedProjects = projects.map(p =>
      p.id === projectId ? { ...p, status } : p
    );
    onUpdate({ ...localClient, projects: updatedProjects });
  };
};

export const createUpdateProjectDateHandler = (
  localClient: Client,
  projects: Project[],
  onUpdate: (client: Client) => void
) => {
  return (projectId: number, newDate: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id === projectId) {
        const dateHistory = p.dateHistory || [];
        return {
          ...p,
          startDate: newDate,
          dateHistory: [...dateHistory, {
            oldDate: p.startDate,
            newDate,
            changedAt: new Date().toISOString()
          }]
        };
      }
      return p;
    });
    onUpdate({ ...localClient, projects: updatedProjects });
  };
};

export const createUpdateProjectShootingStyleHandler = (
  localClient: Client,
  projects: Project[],
  onUpdate: (client: Client) => void
) => {
  return (projectId: number, styleId: string) => {
    const updatedProjects = projects.map(p =>
      p.id === projectId ? { ...p, shootingStyleId: styleId } : p
    );
    onUpdate({ ...localClient, projects: updatedProjects });
  };
};

export const createDocumentUploadedHandler = (
  localClient: Client,
  onUpdate: (client: Client) => void
) => {
  return (document: { id: number; name: string; fileUrl: string; uploadDate: string }) => {
    const documents = localClient.documents || [];
    onUpdate({ ...localClient, documents: [...documents, document] });
    toast.success('Документ загружен');
  };
};

export const createDocumentDeletedHandler = (
  localClient: Client,
  onUpdate: (client: Client) => void
) => {
  return (documentId: number) => {
    const documents = (localClient.documents || []).filter(d => d.id !== documentId);
    onUpdate({ ...localClient, documents });
    toast.success('Документ удалён');
  };
};

export const createFormatDate = () => {
  return (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
};

export const createFormatDateTime = () => {
  return (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
};