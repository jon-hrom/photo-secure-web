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
        const CLIENTS_API = 'https://functions.poehali.dev/d90ae010-c236-4173-bf65-6a3aef34156c';
        console.log('[useClientsSync] Fetching clients for userId:', userId);
        const res = await fetch(`${CLIENTS_API}?userId=${userId}`);
        const data = await res.json();
        console.log('[useClientsSync] Received data:', data.length, 'clients');
        
        const clientsWithDates = data.map((client: any) => ({
          ...client,
          bookings: (client.bookings || []).map((b: any) => ({
            ...b,
            date: new Date(b.booking_date || b.date),
            time: b.booking_time || b.time,
            booking_date: b.booking_date || b.date,
            booking_time: b.booking_time || b.time
          }))
        }));
        
        console.log('[useClientsSync] Setting clients:', clientsWithDates.length, 'clients');
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