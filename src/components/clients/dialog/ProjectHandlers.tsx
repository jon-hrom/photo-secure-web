import { toast } from 'sonner';
import { Client, Project, Payment } from '@/components/clients/ClientsTypes';
import { sendProjectNotification, sendProjectUpdateNotification, sendProjectCancellationNotification } from './NotificationService';
import { todayLocalDate } from '@/utils/dateFormat';

export const createAddProjectHandler = (
  localClient: Client,
  projects: Project[],
  newProject: any,
  setNewProject: (project: any) => void,
  onUpdate: (client: Client) => void,
  photographerName: string,
  onProjectCreated?: (createdProject?: { id: number; name: string; budget: number }) => void
) => {
  return async () => {
    if (!newProject.name || !newProject.budget) {
      toast.error('Заполните название и бюджет проекта');
      return;
    }

    const tempProjectId = Date.now();
    const project: Project = {
      id: tempProjectId,
      name: newProject.name,
      status: 'new',
      budget: parseFloat(newProject.budget),
      startDate: newProject.startDate + 'T12:00:00.000Z',
      description: newProject.description,
      shootingStyleId: newProject.shootingStyleId,
      shooting_time: newProject.shooting_time,
      shooting_duration: newProject.shooting_duration,
      shooting_address: newProject.shooting_address,
      hourly_rate: newProject.hourly_rate !== undefined && newProject.hourly_rate !== ''
        ? parseFloat(String(newProject.hourly_rate).replace(',', '.'))
        : undefined,
      studio_hourly_rate: newProject.studio_hourly_rate !== undefined && newProject.studio_hourly_rate !== ''
        ? parseFloat(String(newProject.studio_hourly_rate).replace(',', '.'))
        : undefined,
      photobook_count: newProject.photobook_count !== undefined && newProject.photobook_count !== ''
        ? parseInt(String(newProject.photobook_count), 10) || 0
        : undefined,
      photobook_price: newProject.photobook_price !== undefined && newProject.photobook_price !== ''
        ? parseFloat(String(newProject.photobook_price).replace(',', '.'))
        : undefined,
      photo_items: Array.isArray(newProject.photo_items)
        ? newProject.photo_items
            .map((it: { format?: string; qty?: string | number; price?: string | number }) => ({
              format: (it.format || '').trim(),
              qty: parseInt(String(it.qty ?? '0'), 10) || 0,
              price: parseFloat(String(it.price ?? '0').replace(',', '.')) || 0,
            }))
            .filter((it) => it.format && (it.qty > 0 || it.price > 0))
        : undefined,
      add_to_calendar: newProject.add_to_calendar
    };

    const updatedBookings = [...localClient.bookings];
    if (newProject.startDate) {
      const bookingDate = new Date(newProject.startDate);
      const booking = {
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

    // Ждём сохранения в БД и получаем реальный ID проекта из БД
    const userId = localStorage.getItem('userId');
    const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';

    let realProject: Project | null = null;
    if (newProject.startDate || newProject.add_to_calendar) {
      // Пытаемся подтянуть реальный проект до 5 раз с паузами
      for (let attempt = 0; attempt < 5 && !realProject; attempt++) {
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 800 : 500));
        try {
          const clientResponse = await fetch(`${CLIENTS_API}?userId=${userId}`, {
            headers: { 'X-User-Id': userId || '' }
          });
          if (clientResponse.ok) {
            const clientsData = await clientResponse.json();
            const updatedClientData = clientsData.find((c: Client) => c.id === localClient.id);
            const found = updatedClientData?.projects?.find((p: Project) =>
              p.name === newProject.name &&
              (p.startDate === newProject.startDate + 'T12:00:00.000Z' || p.startDate?.startsWith(newProject.startDate))
            );
            if (found) realProject = found as Project;
          }
        } catch (e) {
          console.warn('[PROJECT] fetch real project attempt failed', e);
        }
      }
    }

    // Sync with Google Calendar if requested
    if (newProject.add_to_calendar && newProject.startDate) {
      try {
        const CALENDAR_API = 'https://functions.poehali.dev/fc049737-8d51-4e98-95e4-c1dd7f6e6c2c';

        if (realProject) {
          const response = await fetch(CALENDAR_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId || ''
            },
            body: JSON.stringify({
              project_id: realProject.id
            })
          });

          if (response.ok) {
            toast.success('Проект добавлен в Google Calendar');
          } else {
            const error = await response.json();
            toast.error(`Не удалось добавить в календарь: ${error.error}`);
          }
        } else {
          toast.error('Не удалось получить ID проекта для календаря');
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
      startDate: todayLocalDate(),
      shootingStyleId: '',
      shooting_time: '10:00',
      shooting_duration: 120,
      shooting_address: '',
      add_to_calendar: false,
      hourly_rate: '',
      studio_hourly_rate: '',
      photobook_count: '',
      photobook_price: '',
      photo_items: []
    });
    toast.success('Проект сохранён' + (newProject.startDate ? ' и создана запись' : ''));

    if (onProjectCreated) {
      const createdInfo = realProject
        ? { id: realProject.id, name: realProject.name, budget: Number(realProject.budget) || project.budget }
        : { id: project.id, name: project.name, budget: project.budget };
      onProjectCreated(createdInfo);
    }

    // Отправляем уведомления если есть дата съёмки (время по умолчанию 10:00).
    if (newProject.startDate) {
      const notifyToast = toast.loading('Отправляем уведомления...');
      try {
        const projectForNotify = {
          ...project,
          id: realProject?.id ?? project.id,
          shooting_time: project.shooting_time || newProject.shooting_time || '10:00',
        };
        const report = await sendProjectNotification(updatedClient, projectForNotify, photographerName);
        console.log('[PROJECT] Notification report:', report);

        // Формируем подробный список доставки
        const icon = (s: 'sent' | 'failed' | 'skipped') =>
          s === 'sent' ? '✅' : s === 'failed' ? '❌' : '⚪️';
        const label = (s: 'sent' | 'failed' | 'skipped', reason?: string) =>
          s === 'sent' ? 'отправлено'
          : s === 'failed' ? `ошибка${reason ? ` (${reason})` : ''}`
          : reason ? `пропущено (${reason})` : 'пропущено';

        const lines = [
          `${icon(report.whatsappClient)} Клиенту в MAX: ${label(report.whatsappClient, report.reasons.whatsappClient)}`,
          `${icon(report.whatsappPhotographer)} Фотографу в MAX: ${label(report.whatsappPhotographer, report.reasons.whatsappPhotographer)}`,
          `${icon(report.email)} Клиенту на email: ${label(report.email, report.reasons.email)}`,
        ];
        const summary = lines.join('\n');

        const anySent = [report.whatsappClient, report.whatsappPhotographer, report.email].includes('sent');
        const anyFailed = [report.whatsappClient, report.whatsappPhotographer, report.email].includes('failed');

        toast.dismiss(notifyToast);
        if (anySent && !anyFailed) {
          toast.success('Уведомления отправлены', { description: summary, duration: 8000 });
        } else if (anySent && anyFailed) {
          toast.warning('Уведомления отправлены частично', { description: summary, duration: 10000 });
        } else if (anyFailed) {
          toast.error('Не удалось отправить уведомления', { description: summary, duration: 10000 });
        } else {
          toast.info('Уведомления не отправлялись', { description: summary, duration: 8000 });
        }
      } catch (error) {
        toast.dismiss(notifyToast);
        toast.error('Ошибка отправки уведомлений');
        console.error('[PROJECT] Error sending notifications:', error);
      }
    } else {
      console.warn('[PROJECT] Notifications skipped: no startDate set');
    }
  };
};

export const createUpdateProjectHandler = (
  localClient: Client,
  projects: Project[],
  onUpdate: (client: Client) => void,
  photographerName?: string
) => {
  return async (projectId: number, updates: Partial<Project>, notifyClient: boolean = true) => {
    const oldProject = projects.find(p => p.id === projectId);
    const updatedProjects = projects.map(p =>
      p.id === projectId ? { ...p, ...updates } : p
    );

    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
    };

    onUpdate(updatedClient);

    // Отмена съёмки: особое заботливое уведомление клиенту и фотографу.
    const becameCancelled = updates.status === 'cancelled' && oldProject?.status !== 'cancelled';
    if (notifyClient && oldProject && becameCancelled) {
      const updatedProject = updatedProjects.find(p => p.id === projectId);
      if (updatedProject) {
        // Ждём, пока проект сохранится в БД (статус, причина, перевод предоплаты в резерв),
        // чтобы уведомление прочитало актуальные данные и корректную сумму резерва.
        await new Promise((r) => setTimeout(r, 2000));
        try {
          await sendProjectCancellationNotification(localClient, updatedProject);
          console.log('[PROJECT] Cancellation notification sent for project:', projectId);
        } catch (error) {
          console.error('[PROJECT] Error sending cancellation notification:', error);
        }
      }
    } else if (notifyClient && oldProject && photographerName) {
      // Send update notification if important fields changed AND caller requested notification
      const importantFieldsChanged = 
        updates.startDate !== undefined ||
        updates.shooting_time !== undefined ||
        updates.shooting_address !== undefined ||
        updates.shooting_duration !== undefined ||
        updates.status !== undefined;

      if (importantFieldsChanged) {
        const updatedProject = updatedProjects.find(p => p.id === projectId);
        if (updatedProject) {
          try {
            await sendProjectUpdateNotification(localClient, oldProject, updatedProject, photographerName);
            console.log('[PROJECT] Update notification sent for project:', projectId);
          } catch (error) {
            console.error('[PROJECT] Error sending update notification:', error);
          }
        }
      }
    }
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
    
    const updatedProjects = projects.map(p => {
      if (p.id === projectId) {
        const updates: Partial<Project> = { status };
        
        // При завершении или отмене проекта сохраняем дату завершения
        if (status === 'completed' || status === 'cancelled') {
          updates.endDate = new Date().toISOString();
        }
        
        return { ...p, ...updates };
      }
      return p;
    });
    
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