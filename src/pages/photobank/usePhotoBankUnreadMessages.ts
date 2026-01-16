import { useEffect } from 'react';

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
        
        const unreadMap = new Map(
          data.folders.map((f: { folder_id: number; unread_count: number }) => [f.folder_id, f.unread_count])
        );
        console.log('[UNREAD_COUNTS] Unread map:', Array.from(unreadMap.entries()));

        setFolders(prev => {
          const updated = prev.map(folder => ({
            ...folder,
            unread_messages_count: unreadMap.get(folder.id) || 0
          }));
          console.log('[UNREAD_COUNTS] Updated folders:', updated.map(f => ({ id: f.id, name: f.folder_name, unread: f.unread_messages_count })));
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
