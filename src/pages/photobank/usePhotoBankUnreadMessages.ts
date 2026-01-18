import { useEffect, useRef } from 'react';
import { playNotificationSound } from '@/utils/notificationSound';

interface UsePhotoBankUnreadMessagesProps {
  userId: string;
  foldersLength: number;
  setFolders: (updater: (prev: any[]) => any[]) => void;
}

export const usePhotoBankUnreadMessages = ({
  userId,
  foldersLength,
  setFolders,
}: UsePhotoBankUnreadMessagesProps) => {
  const previousUnreadTotal = useRef<number>(0);

  useEffect(() => {
    const loadUnreadCounts = async () => {
      if (!userId || foldersLength === 0) {
        console.log('[UNREAD_COUNTS] Skipping: userId=', userId, 'folders.length=', foldersLength);
        return;
      }

      try {
        const url = `https://functions.poehali.dev/ac9cc03a-3a9c-4359-acca-5cf58252f6d1?photographer_id=${userId}`;
        console.log('[UNREAD_COUNTS] Fetching from:', url);
        
        const response = await fetch(url);
        console.log('[UNREAD_COUNTS] Response status:', response.status);
        
        if (!response.ok) {
          console.error('[UNREAD_COUNTS] Response not ok:', response.status);
          return;
        }
        
        const data = await response.json();
        console.log('[UNREAD_COUNTS] Received data:', data);
        
        const messagesMap = new Map(
          data.folders.map((f: { folder_id: number; unread_count: number; total_count: number }) => [
            f.folder_id, 
            { unread: f.unread_count, total: f.total_count }
          ])
        );
        console.log('[UNREAD_COUNTS] Messages map:', Array.from(messagesMap.entries()));

        // Подсчитываем общее количество непрочитанных
        const totalUnread = Array.from(messagesMap.values()).reduce((sum, counts) => sum + counts.unread, 0);
        
        // Проигрываем звук, если количество непрочитанных увеличилось
        if (totalUnread > previousUnreadTotal.current && previousUnreadTotal.current >= 0) {
          console.log('[SOUND] Playing notification sound for photographer, unread changed:', previousUnreadTotal.current, '->', totalUnread);
          playNotificationSound();
        }
        previousUnreadTotal.current = totalUnread;

        setFolders(prev => {
          const updated = prev.map(folder => {
            const counts = messagesMap.get(folder.id) || { unread: 0, total: 0 };
            return {
              ...folder,
              unread_messages_count: counts.unread,
              total_messages_count: counts.total
            };
          });
          console.log('[UNREAD_COUNTS] Updated folders:', updated.map(f => ({ 
            id: f.id, 
            name: f.folder_name, 
            unread: f.unread_messages_count,
            total: f.total_messages_count 
          })));
          return updated;
        });
      } catch (error) {
        console.error('[UNREAD_COUNTS] Error:', error);
      }
    };

    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 10000);
    return () => clearInterval(interval);
  }, [userId, foldersLength, setFolders]);
};