import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';

export const useClientsData = (userId: string | null) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(true);
  
  const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
  
  const loadClients = async () => {
    if (!userId) {
      console.log('[CLIENTS] No userId, skipping load');
      setLoading(false);
      return;
    }
    
    try {
      console.log('[CLIENTS] Loading clients for userId:', userId);
      const res = await fetch(CLIENTS_API, {
        headers: { 'X-User-Id': userId }
      });
      
      console.log('[CLIENTS] Response status:', res.status);
      
      if (!res.ok) throw new Error('Failed to load clients');
      
      const data = await res.json();
      const parsed = data.map((client: any) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        address: client.address || '',
        vkProfile: client.vk_profile || '',
        bookings: (client.bookings || []).map((b: any) => ({
          id: b.id,
          date: new Date(b.booking_date),
          time: b.booking_time,
          description: b.description || '',
          notificationEnabled: b.notification_enabled,
          clientId: b.client_id
        })),
        projects: client.projects || [],
        payments: client.payments || [],
        documents: client.documents || [],
        comments: client.comments || [],
        messages: client.messages || []
      }));
      
      setClients(parsed);
      console.log('[CLIENTS] Loaded', parsed.length, 'clients successfully');
    } catch (error) {
      console.error('[CLIENTS] Failed to load clients:', error);
      toast.error('Не удалось загрузить клиентов');
    } finally {
      console.log('[CLIENTS] Setting loading to false');
      setLoading(false);
    }
  };
  
  const checkEmailVerification = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${userId}`);
      const data = await res.json();
      setEmailVerified(!!data.email_verified_at);
    } catch (err) {
      console.error('Failed to check email verification:', err);
    }
  };
  
  useEffect(() => {
    loadClients();
    checkEmailVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  
  return {
    clients,
    setClients,
    loading,
    emailVerified,
    loadClients,
    CLIENTS_API
  };
};