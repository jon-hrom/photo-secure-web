import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';

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
