import { toast } from 'sonner';
import { Client, Project, Payment } from '@/components/clients/ClientsTypes';

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
