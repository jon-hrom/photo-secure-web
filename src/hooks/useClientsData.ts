import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';
import { isAdminUser } from '@/utils/adminCheck';

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
      console.log('[CLIENTS] Raw data sample:', data[0]);
      
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
          booking_date: b.booking_date,
          time: b.booking_time,
          booking_time: b.booking_time,
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
          description: p.description || ''
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
      
      console.log('[CLIENTS] Parsed data sample:', parsed[0]);
      console.log('[CLIENTS] Sample payments:', parsed[0]?.payments);
      console.log('[CLIENTS] Sample projects:', parsed[0]?.projects);
      
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
      
      const vkUser = localStorage.getItem('vk_user');
      const authSession = localStorage.getItem('authSession');
      
      let userEmail = data.email || null;
      let vkUserData = null;
      
      if (authSession) {
        try {
          const session = JSON.parse(authSession);
          if (session.userEmail) userEmail = session.userEmail;
        } catch {}
      }
      
      if (vkUser) {
        try {
          vkUserData = JSON.parse(vkUser);
        } catch {}
      }
      
      if (isAdminUser(userEmail, vkUserData)) {
        console.log('[CLIENTS] Main admin detected - email verification skipped');
        setEmailVerified(true);
        return;
      }
      
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