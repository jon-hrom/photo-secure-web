import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';

interface ClientsPageEffectsProps {
  loading: boolean;
  userId: string | null;
  emailVerified: boolean;
  clients: Client[];
  autoOpenAddDialog?: boolean;
  autoOpenClient?: string;
  onAddDialogClose?: () => void;
  setIsAddDialogOpen: (value: boolean) => void;
  setSelectedClient: (client: Client) => void;
  setIsDetailDialogOpen: (value: boolean) => void;
  loadClientData: () => any;
  hasAnyUnsavedProject?: () => { hasUnsaved: boolean; clientId: string | null };
  hasAnyOpenCard: () => { hasOpen: boolean; clientId: string | null; clientName: string | null };
  handleOpenAddDialog: () => void;
  handleOpenClientWithProjectCheck: (client: Client) => void;
}

export const ClientsPageEffects = ({
  loading,
  userId,
  emailVerified,
  clients,
  autoOpenAddDialog,
  autoOpenClient,
  onAddDialogClose,
  setIsAddDialogOpen,
  setSelectedClient,
  setIsDetailDialogOpen,
  loadClientData,
  hasAnyUnsavedProject,
  hasAnyOpenCard,
  handleOpenAddDialog,
  handleOpenClientWithProjectCheck,
}: ClientsPageEffectsProps) => {
  const navigate = useNavigate();

  // Открываем диалог добавления клиента при autoOpenAddDialog
  useEffect(() => {
    if (autoOpenAddDialog) {
      setIsAddDialogOpen(true);
      if (onAddDialogClose) {
        onAddDialogClose();
      }
    }
  }, [autoOpenAddDialog, onAddDialogClose, setIsAddDialogOpen]);

  // Уведомление о статусе email при загрузке страницы
  useEffect(() => {
    if (!loading && userId) {
      const hasSeenEmailNotification = sessionStorage.getItem(`email_status_notification_seen_${userId}`);
      
      if (!hasSeenEmailNotification) {
        const googleUser = localStorage.getItem('google_user');
        
        if (googleUser) {
          setTimeout(() => {
            toast.success('Ваша почта подтверждена автоматически', {
              description: 'Вы вошли через Google — email подтверждён',
              duration: 5000,
            });
          }, 500);
          sessionStorage.setItem(`email_status_notification_seen_${userId}`, 'true');
        } else if (!emailVerified) {
          setTimeout(() => {
            toast.warning('Подтвердите вашу почту', {
              description: 'Для полного доступа к функциям подтвердите email в настройках',
              duration: 8000,
              action: {
                label: 'Настройки',
                onClick: () => navigate('/settings')
              }
            });
          }, 500);
          sessionStorage.setItem(`email_status_notification_seen_${userId}`, 'true');
        }
      }
    }
  }, [loading, userId, emailVerified, navigate]);

  // Проверка несохранённых данных при загрузке страницы
  useEffect(() => {
    if (!loading && clients.length > 0 && userId) {
      const hasSeenUnsavedNotification = sessionStorage.getItem(`unsaved_notification_seen_${userId}`);
      
      if (!hasSeenUnsavedNotification) {
        const savedClient = loadClientData();
        const { hasUnsaved, clientId } = hasAnyUnsavedProject ? hasAnyUnsavedProject() : { hasUnsaved: false, clientId: null };
        const { hasOpen, clientId: openCardClientId, clientName: openCardClientName } = hasAnyOpenCard();
        
        if (savedClient && (savedClient.name || savedClient.phone || savedClient.email)) {
          setTimeout(() => {
            toast.info('У вас есть несохранённые данные клиента', {
              description: 'Нажмите на кнопку "Добавить клиента" чтобы продолжить',
              duration: 8000,
              action: {
                label: 'Продолжить',
                onClick: () => handleOpenAddDialog()
              }
            });
          }, 1000);
          sessionStorage.setItem(`unsaved_notification_seen_${userId}`, 'true');
        } else if (hasOpen && openCardClientId && openCardClientName) {
          setTimeout(() => {
            toast.info(`У вас незавершённая работа с ${openCardClientName}`, {
              description: 'Карточка клиента была закрыта без добавления проекта',
              duration: 8000,
              action: {
                label: 'Продолжить',
                onClick: () => {
                  const client = clients.find(c => c.id === openCardClientId);
                  if (client) {
                    handleOpenClientWithProjectCheck(client);
                  }
                }
              }
            });
          }, 1000);
          sessionStorage.setItem(`unsaved_notification_seen_${userId}`, 'true');
        } else if (hasUnsaved && clientId) {
          setTimeout(() => {
            const client = clients.find(c => c.id === clientId);
            const clientName = client ? client.name : 'клиента';
            toast.info(`У вас есть несохранённый проект для ${clientName}`, {
              description: 'Нажмите на кнопку "Добавить клиента" чтобы продолжить',
              duration: 8000,
              action: {
                label: 'Продолжить',
                onClick: () => handleOpenAddDialog()
              }
            });
          }, 1000);
          sessionStorage.setItem(`unsaved_notification_seen_${userId}`, 'true');
        }
      }
    }
  }, [loading, clients, userId, loadClientData, hasAnyUnsavedProject, hasAnyOpenCard, handleOpenAddDialog, handleOpenClientWithProjectCheck]);

  // Автооткрытие клиента при передаче autoOpenClient
  useEffect(() => {
    if (autoOpenClient) {
      const client = clients.find(c => c.name === autoOpenClient);
      if (client) {
        setSelectedClient(client);
        setIsDetailDialogOpen(true);
      } else {
        toast.info(`Клиент "${autoOpenClient}" не найден в базе`);
      }
    }
  }, [autoOpenClient, clients, setSelectedClient, setIsDetailDialogOpen]);

  return null;
};
