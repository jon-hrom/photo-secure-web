import { useEffect, useState, useRef } from 'react';
import { IncomingTransfer, transferApi } from './transferApi';
import IncomingTransferModal from './IncomingTransferModal';

/**
 * Глобальный наблюдатель за входящими передачами клиентов.
 * - При входе в приложение опрашивает список pending
 * - Каждые 60 сек повторяет опрос
 * - Показывает модалку по центру с медленным появлением
 */
const IncomingTransfersWatcher = () => {
  const [queue, setQueue] = useState<IncomingTransfer[]>([]);
  const [current, setCurrent] = useState<IncomingTransfer | null>(null);
  const dismissedIds = useRef<Set<number>>(new Set());

  const fetchTransfers = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
      const data = await transferApi.listIncoming();
      const fresh = (data.transfers || []).filter(t => !dismissedIds.current.has(t.id));
      if (fresh.length > 0) {
        setQueue(prev => {
          const ids = new Set(prev.map(p => p.id));
          const toAdd = fresh.filter(t => !ids.has(t.id));
          return [...prev, ...toAdd];
        });
      }
    } catch {
      // Молча игнорим — это фоновый опрос
    }
  };

  useEffect(() => {
    fetchTransfers();
    const interval = setInterval(fetchTransfers, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const next = queue[0];
      setCurrent(next);
      transferApi.markSeen(next.id).catch(() => {});
    }
  }, [queue, current]);

  const handleResolved = () => {
    if (current) {
      dismissedIds.current.add(current.id);
      setQueue(q => q.filter(t => t.id !== current.id));
      setCurrent(null);
    }
  };

  const handleClose = () => {
    // Закрытие без ответа — откладываем (покажем при следующем заходе)
    if (current) {
      dismissedIds.current.add(current.id);
      setQueue(q => q.filter(t => t.id !== current.id));
      setCurrent(null);
    }
  };

  return (
    <IncomingTransferModal
      transfer={current}
      onResolved={handleResolved}
      onClose={handleClose}
    />
  );
};

export default IncomingTransfersWatcher;
