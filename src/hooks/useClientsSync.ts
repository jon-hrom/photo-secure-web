import { useState, useEffect } from 'react';
import { Client } from '@/components/clients/ClientsTypes';

interface UseClientsSyncProps {
  isAuthenticated: boolean;
  userId: string | number | null;
}

export const useClientsSync = ({ isAuthenticated, userId }: UseClientsSyncProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const fetchClients = async () => {
      if (!isAuthenticated || !userId) {
        setClients([]);
        return;
      }

      setClientsLoading(true);
      try {
        const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
        const res = await fetch(CLIENTS_API, {
          headers: { 'X-User-Id': userId.toString() }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        
        const clientsWithDates = data.map((client: any) => ({
          id: client.id,
          name: client.name,
          phone: client.phone,
          email: client.email || '',
          address: client.address || '',
          vkProfile: client.vk_profile || '',
          created_at: client.created_at,
          bookings: (client.bookings || []).map((b: any) => ({
            id: b.id,
            date: new Date(b.booking_date),
            booking_date: b.booking_date,
            time: b.booking_time,
            booking_time: b.booking_time,
            title: b.title || '',
            description: b.description || '',
            notificationEnabled: b.notification_enabled,
            notification_enabled: b.notification_enabled,
            notificationTime: b.notification_time || 24,
            notification_time: b.notification_time || 24,
            clientId: b.client_id,
            client_id: b.client_id
          })),
          projects: (client.projects || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            budget: parseFloat(p.budget) || 0,
            startDate: p.start_date || p.startDate,
            description: p.description || '',
            shootingStyleId: p.shooting_style_id || p.shootingStyleId || undefined
          })),
          payments: (client.payments || []).map((pay: any) => ({
            id: pay.id,
            amount: parseFloat(pay.amount) || 0,
            date: pay.payment_date || pay.date,
            status: pay.status,
            method: pay.method,
            description: pay.description || '',
            projectId: pay.project_id || pay.projectId
          })),
          documents: (client.documents || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            fileUrl: d.file_url,
            uploadDate: d.upload_date
          })),
          comments: (client.comments || []).map((c: any) => ({
            id: c.id,
            author: c.author,
            text: c.text,
            date: c.comment_date || c.date
          })),
          messages: (client.messages || []).map((m: any) => ({
            id: m.id,
            type: m.type,
            author: m.author,
            content: m.content,
            date: m.message_date || m.date
          }))
        }));
        
        setClients(clientsWithDates);
        setLastSyncTime(new Date());
      } catch (error) {
        console.error('Failed to load clients:', error);
        setClients([]);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
    
    const interval = setInterval(fetchClients, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, userId]);

  return { clients, setClients, clientsLoading, lastSyncTime };
};