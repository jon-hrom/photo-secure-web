import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';
import { isAdminUser } from '@/utils/adminCheck';

export const useClientsData = (
  userId: string | null, 
  propClients?: Client[], 
  onClientsUpdate?: (clients: Client[]) => void
) => {
  const [clients, setClientsState] = useState<Client[]>(propClients || []);
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  
  const CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
  
  // Синхронизируем с propClients когда они меняются
  useEffect(() => {
    if (propClients) {
      setClientsState(propClients);
    }
  }, [propClients]);
  
  // Обёртка для setClients, которая вызывает onClientsUpdate
  const setClients = (newClients: Client[] | ((prev: Client[]) => Client[])) => {
    const updated = typeof newClients === 'function' ? newClients(clients) : newClients;
    setClientsState(updated);
    if (onClientsUpdate) {
      onClientsUpdate(updated);
    }
  };
  
  const loadClients = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
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
        vk_username: client.vk_username || '',
        birthdate: client.birthdate || '',
        avatar_url: client.avatar_url || null,
        telegram_chat_id: client.telegram_chat_id || null,
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
        projects: (client.projects || []).map((p: any) => {
          const rawDate = p.start_date || p.startDate;
          let normalizedDate: string | null = null;
          if (rawDate && rawDate !== 'None' && rawDate !== 'null') {
            const s = String(rawDate);
            const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) {
              normalizedDate = match[1];
            } else {
              const d = new Date(s);
              if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                normalizedDate = `${y}-${m}-${day}`;
              }
            }
          }
          return {
          id: p.id,
          name: p.name,
          status: p.status,
          budget: parseFloat(p.budget) || 0,
          startDate: normalizedDate,
          description: p.description || '',
          shootingStyleId: p.shooting_style_id || p.shootingStyleId || undefined,
          shooting_time: p.shooting_time,
          shooting_duration: p.shooting_duration,
          shooting_address: p.shooting_address,
          add_to_calendar: p.add_to_calendar
          };
        }),
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
          date: m.message_date || m.date,
          delivery_status: m.delivery_status || null,
          delivery_error: m.delivery_error || null,
          external_message_id: m.external_message_id || null,
        })),
        refunds: (client.refunds || []).map((r: any) => ({
          id: r.id,
          paymentId: r.paymentId || r.payment_id,
          projectId: r.projectId || r.project_id,
          amount: parseFloat(r.amount) || 0,
          reason: r.reason || '',
          type: r.type,
          status: r.status,
          method: r.method || '',
          date: r.date || r.refund_date,
          paymentSystemId: r.paymentSystemId || r.payment_system_id
        }))
      }));
      
      const avatarsCount = parsed.filter((c: { avatar_url: string | null }) => !!c.avatar_url).length;
      console.log(`[loadClients] Loaded ${parsed.length} clients, ${avatarsCount} with avatars`);
      if (avatarsCount > 0) {
        const sample = parsed.find((c: { avatar_url: string | null }) => !!c.avatar_url);
        console.log('[loadClients] Sample avatar URL:', sample?.avatar_url);
      }
      setClients(parsed);
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
      const res = await fetch('https://functions.poehali.dev/8ce3cb93-2701-441d-aa3b-e9c0e99a9994', {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      
      if (!data.success || !data.settings) {
        setEmailVerified(false);
        return;
      }
      
      const vkUser = localStorage.getItem('vk_user');
      const googleUser = localStorage.getItem('google_user');
      const yandexUser = localStorage.getItem('yandex_user');
      const authSession = localStorage.getItem('authSession');
      
      console.log('[EMAIL_VERIFICATION] Checking verification for user:', {
        userId,
        hasGoogleUser: !!googleUser,
        hasYandexUser: !!yandexUser,
        hasVkUser: !!vkUser,
        settingsSource: data.settings.source,
        emailVerifiedAt: data.settings.email_verified_at
      });
      
      let userEmail = data.settings.email || null;
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
      
      // Админы всегда имеют доступ
      if (isAdminUser(userEmail, vkUserData)) {
        console.log('[EMAIL_VERIFICATION] Admin user - email auto-verified');
        setEmailVerified(true);
        return;
      }
      
      // Google пользователи имеют автоматически подтверждённую почту
      if (googleUser || data.settings.source === 'google') {
        console.log('[EMAIL_VERIFICATION] Google user detected - email auto-verified', {
          hasGoogleUserInLocalStorage: !!googleUser,
          sourceIsGoogle: data.settings.source === 'google'
        });
        setEmailVerified(true);
        return;
      }
      
      // Yandex пользователи имеют автоматически подтверждённую почту
      if (yandexUser || data.settings.source === 'yandex') {
        console.log('[EMAIL_VERIFICATION] Yandex user detected - email auto-verified', {
          hasYandexUserInLocalStorage: !!yandexUser,
          sourceIsYandex: data.settings.source === 'yandex'
        });
        setEmailVerified(true);
        return;
      }
      
      // Остальные проверяют по email_verified_at
      const isVerified = !!data.settings.email_verified_at;
      console.log('[EMAIL_VERIFICATION] Email verification status:', {
        email: userEmail,
        verified: isVerified,
        verified_at: data.settings.email_verified_at,
        source: data.settings.source
      });
      setEmailVerified(isVerified);
    } catch (err) {
      console.error('Failed to check email verification:', err);
    }
  };
  
  useEffect(() => {
    // Загружаем только проверку email (быстрая операция)
    checkEmailVerification();
    
    // Загрузку клиентов откладываем на 100ms - даём UI отрисоваться
    // Но только если propClients не переданы
    if (propClients === undefined) {
      const timer = setTimeout(() => {
        loadClients();
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, propClients]);
  
  return {
    clients,
    setClients,
    loading,
    emailVerified,
    loadClients,
    CLIENTS_API
  };
};