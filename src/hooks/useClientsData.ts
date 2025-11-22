import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';

export const useClientsData = (userId: string | null) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(true);
  
  const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
  
  const loadClients = async () => {
    if (!userId) return;
    
    try {
      const res = await fetch(CLIENTS_API, {
        headers: { 'X-User-Id': userId }
      });
      
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
      
      // Миграция данных из localStorage если есть
      const localData = localStorage.getItem(`clients_${userId}`);
      if (localData && parsed.length === 0) {
        try {
          const localClients = JSON.parse(localData);
          if (localClients.length > 0) {
            for (const client of localClients) {
              await fetch(CLIENTS_API, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Id': userId
                },
                body: JSON.stringify({
                  action: 'create',
                  name: client.name,
                  phone: client.phone,
                  email: client.email,
                  address: client.address,
                  vkProfile: client.vkProfile
                })
              });
            }
            localStorage.removeItem(`clients_${userId}`);
            await loadClients();
            toast.success('Данные перенесены в облако');
          }
        } catch (e) {
          console.error('Migration failed:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
      toast.error('Не удалось загрузить клиентов');
    } finally {
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
