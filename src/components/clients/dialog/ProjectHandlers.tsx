import { toast } from 'sonner';
import { Client, Project, Payment } from '@/components/clients/ClientsTypes';
import { sendProjectNotification, sendProjectUpdateNotification } from './NotificationService';

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

    const tempProjectId = Date.now();
    const project: Project = {
      id: tempProjectId,
      name: newProject.name,
      status: 'new',
      budget: parseFloat(newProject.budget),
      startDate: new Date(newProject.startDate).toISOString(),
      description: newProject.description,
      shootingStyleId: newProject.shootingStyleId,
      shooting_time: newProject.shooting_time,
      shooting_duration: newProject.shooting_duration,
      shooting_address: newProject.shooting_address,
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

    // Wait for database to save and get real project ID
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Sync with Google Calendar if requested
    if (newProject.add_to_calendar && newProject.startDate) {
      try {
        const CALENDAR_API = 'https://functions.poehali.dev/fc049737-8d51-4e98-95e4-c1dd7f6e6c2c';
        const userId = localStorage.getItem('userId');
        const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
        
        // Get updated client data with real project ID from database
        const clientResponse = await fetch(`${CLIENTS_API}?userId=${userId}`, {
          headers: { 'X-User-Id': userId || '' }
        });
        
        if (clientResponse.ok) {
          const clientsData = await clientResponse.json();
          const updatedClientData = clientsData.find((c: Client) => c.id === localClient.id);
          
          // Find the newly created project by matching name and date
          const realProject = updatedClientData?.projects?.find((p: Project) => 
            p.name === newProject.name && 
            p.startDate === new Date(newProject.startDate).toISOString() &&
            p.id !== tempProjectId
          );
          
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

export const createUpdateProjectHandler = (
  localClient: Client,
  projects: Project[],
  onUpdate: (client: Client) => void,
  photographerName?: string
) => {
  return async (projectId: number, updates: Partial<Project>) => {
    const oldProject = projects.find(p => p.id === projectId);
    const updatedProjects = projects.map(p =>
      p.id === projectId ? { ...p, ...updates } : p
    );

    const updatedClient = {
      ...localClient,
      projects: updatedProjects,
    };

    onUpdate(updatedClient);

    // Send update notification if important fields changed
    if (oldProject && photographerName) {
      const importantFieldsChanged = 
        updates.startDate !== undefined ||
        updates.shooting_time !== undefined ||
        updates.shooting_address !== undefined ||
        updates.shooting_duration !== undefined ||
        updates.status !== undefined;

      if (importantFieldsChanged) {
        const updatedProject = updatedProjects.find(p => p.id === projectId);
        if (updatedProject) {
          await sendProjectUpdateNotification(localClient, oldProject, updatedProject, photographerName);
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