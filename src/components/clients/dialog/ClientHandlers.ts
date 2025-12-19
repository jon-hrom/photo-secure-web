import { toast } from 'sonner';
import { Client, Project, Payment, Comment, Message, Booking } from '@/components/clients/ClientsTypes';
import { sendProjectNotification } from './NotificationService';

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
      startDate: new Date().toISOString().split('T')[0],
      shootingStyleId: ''
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

      const totalRemaining = projectsNeedingPayment.reduce((sum, p) => sum + p.remainingAmount, 0);

      projectsNeedingPayment.forEach(({ project }) => {
        const projectShare = (project.budget / totalRemaining) * totalAmount;
        
        const payment: Payment = {
          id: Date.now() + Math.random(),
          projectId: project.id,
          amount: Math.round(projectShare * 100) / 100,
          date: paymentDate,
          method: newPayment.method || 'cash',
        };
        newPayments.push(payment);
      });
    } else {
      const payment: Payment = {
        id: Date.now(),
        projectId: newPayment.projectId,
        amount: totalAmount,
        date: paymentDate,
        method: newPayment.method || 'cash',
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
      date: new Date(),
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
      text: newMessage.text,
      date: new Date(),
      type: newMessage.type || 'outgoing',
    };

    const updatedClient = {
      ...localClient,
      messages: [...messages, message],
    };

    onUpdate(updatedClient);
    setNewMessage({ text: '', type: 'outgoing' });
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
  return (projectId: number) => {
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
  return (status: 'new' | 'in-progress' | 'completed' | 'cancelled') => {
    const statusConfig = {
      'new': { label: 'Новый', variant: 'default' as const },
      'in-progress': { label: 'В работе', variant: 'default' as const },
      'completed': { label: 'Завершён', variant: 'default' as const },
      'cancelled': { label: 'Отменён', variant: 'destructive' as const },
    };
    return statusConfig[status];
  };
};
