import { useEffect, useCallback } from 'react';
import { playNotificationSound } from '@/utils/notificationSound';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
  is_video?: boolean;
  content_type?: string;
}

interface FavoriteFolder {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
  photoCount: number;
  photos: Photo[];
}

interface GalleryData {
  photographer_id?: number;
  favorite_config?: FavoriteFolder | null;
}

interface GalleryHandlersParams {
  code?: string;
  gallery: GalleryData | null;
  clientData: { client_id: number; full_name: string; phone: string; email?: string } | null;
  favoriteFolder: FavoriteFolder | null;
  isChatOpen: boolean;
  setClientData: (data: { client_id: number; full_name: string; phone: string; email?: string } | null) => void;
  setFavoriteFolder: (folder: FavoriteFolder | null) => void;
  setClientFavoritePhotoIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  setUnreadCount: (count: number) => void;
  setPhotoToAdd: (photo: Photo | null) => void;
  setIsFavoritesModalOpen: (open: boolean) => void;
  previousUnreadCount: React.MutableRefObject<number>;
}

export function useGalleryHandlers(params: GalleryHandlersParams) {
  const {
    code,
    gallery,
    clientData,
    favoriteFolder,
    isChatOpen,
    setClientData,
    setFavoriteFolder,
    setClientFavoritePhotoIds,
    setUnreadCount,
    setPhotoToAdd,
    setIsFavoritesModalOpen,
    previousUnreadCount
  } = params;

  const loadClientFavorites = useCallback(async (clientId: number) => {
    try {
      const response = await fetch(
        `https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723?client_id=${clientId}`
      );
      const result = await response.json();
      
      if (response.ok && result.photos) {
        const photoIds = result.photos.map((p: { photo_id: number }) => p.photo_id);
        setClientFavoritePhotoIds(photoIds);
        console.log('[FAVORITES] Loaded client favorites:', photoIds);
      }
    } catch (error) {
      console.error('[FAVORITES] Error loading client favorites:', error);
    }
  }, [setClientFavoritePhotoIds]);

  const loadUnreadCount = useCallback(async () => {
    if (!clientData || !gallery) return;
    
    try {
      const response = await fetch(
        `https://functions.poehali.dev/ac9cc03a-3a9c-4359-acca-5cf58252f6d1?photographer_id=${gallery.photographer_id}&client_id=${clientData.client_id}`
      );
      const data = await response.json();
      
      if (response.ok) {
        const newUnreadCount = data.unread_count || 0;
        
        if (!isChatOpen && newUnreadCount > previousUnreadCount.current && previousUnreadCount.current >= 0) {
          console.log('[SOUND] Playing notification sound for client, unread changed:', previousUnreadCount.current, '->', newUnreadCount);
          playNotificationSound();
        }
        
        previousUnreadCount.current = newUnreadCount;
        setUnreadCount(newUnreadCount);
      }
    } catch (error) {
      console.error('[CHAT] Error loading unread count:', error);
    }
  }, [clientData, gallery, isChatOpen, previousUnreadCount, setUnreadCount]);

  useEffect(() => {
    if (gallery?.favorite_config) {
      console.log('[FAVORITES] Loaded favorite config from server:', gallery.favorite_config);
      setFavoriteFolder(gallery.favorite_config);
    }
    
    if (gallery && !clientData) {
      const savedClientData = localStorage.getItem(`client_${gallery.photographer_id}_${code}`);
      if (savedClientData) {
        try {
          const parsed = JSON.parse(savedClientData);
          console.log('[CLIENT_LOGIN] Auto-login from localStorage:', parsed);
          setClientData(parsed);
          if (parsed.client_id) {
            loadClientFavorites(parsed.client_id);
          }
        } catch (error) {
          console.error('[CLIENT_LOGIN] Error parsing saved client data:', error);
        }
      }
    }
  }, [gallery, clientData, code, setFavoriteFolder, setClientData, loadClientFavorites]);

  useEffect(() => {
    if (clientData && gallery) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 5000);
      return () => clearInterval(interval);
    }
  }, [clientData, gallery, loadUnreadCount]);

  const handleAddToFavorites = async (photo: Photo) => {
    if (!favoriteFolder) {
      alert('Фотограф ещё не настроил папку избранного');
      return;
    }
    
    if (clientData && clientData.client_id > 0) {
      const galleryCode = code;
      console.log('[FAVORITES] Adding photo for logged-in client:', {
        gallery_code: galleryCode,
        full_name: clientData.full_name,
        phone: clientData.phone,
        photo_id: photo.id
      });
      
      try {
        const response = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_to_favorites',
            gallery_code: galleryCode,
            full_name: clientData.full_name,
            phone: clientData.phone,
            email: clientData.email || null,
            photo_id: photo.id
          })
        });
        
        const result = await response.json();
        console.log('[FAVORITES] Add response:', result);
        
        if (!response.ok) {
          throw new Error(result.error || 'Ошибка при добавлении в избранное');
        }
        
        setClientFavoritePhotoIds(prev => [...prev, photo.id]);
      } catch (error) {
        console.error('[FAVORITES] Error adding photo:', error);
        alert(error instanceof Error ? error.message : 'Ошибка при добавлении в избранное');
      }
    } else {
      setPhotoToAdd(photo);
      setIsFavoritesModalOpen(true);
    }
  };

  const handleFavoriteSubmit = async (data: { fullName: string; phone: string; email?: string; client_id?: number }) => {
    if (!data.client_id) {
      console.error('[FAVORITES] No client_id in response');
      return;
    }
    
    const newClientData = {
      client_id: data.client_id,
      full_name: data.fullName,
      phone: data.phone,
      email: data.email
    };
    
    setClientData(newClientData);
    if (gallery) {
      localStorage.setItem(`client_${gallery.photographer_id}_${code}`, JSON.stringify(newClientData));
    }
    
    await loadClientFavorites(data.client_id);
  };

  const handleClientLogin = async (clientData: { client_id: number; full_name: string; phone: string; email?: string }) => {
    setClientData(clientData);
    if (gallery) {
      localStorage.setItem(`client_${gallery.photographer_id}_${code}`, JSON.stringify(clientData));
    }
    
    if (clientData.client_id) {
      await loadClientFavorites(clientData.client_id);
    }
  };

  const handleLogout = () => {
    if (gallery) {
      localStorage.removeItem(`client_${gallery.photographer_id}_${code}`);
    }
    setClientData(null);
    setClientFavoritePhotoIds([]);
  };

  const handleRemoveFromFavorites = async (photoId: number) => {
    if (!clientData || clientData.client_id <= 0) return;
    
    try {
      const response = await fetch(
        `https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723?client_id=${clientData.client_id}&photo_id=${photoId}`,
        { method: 'DELETE' }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при удалении из избранного');
      }
      
      setClientFavoritePhotoIds(prev => prev.filter(id => id !== photoId));
    } catch (error) {
      console.error('[FAVORITES] Error removing photo:', error);
      alert(error instanceof Error ? error.message : 'Ошибка при удалении из избранного');
    }
  };

  const handleFavoritesFolderSelect = async (folderId: string, clientInfo: { fullName: string; phone: string; email?: string }) => {
    if (!photoToAdd) return;
    
    try {
      const response = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_to_favorites',
          gallery_code: code,
          full_name: clientInfo.fullName,
          phone: clientInfo.phone,
          email: clientInfo.email || null,
          photo_id: photoToAdd.id
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при добавлении в избранное');
      }
      
      setIsFavoritesModalOpen(false);
      setPhotoToAdd(null);
      
      alert('Фото добавлено в избранное!');
    } catch (error) {
      console.error('[FAVORITES] Error:', error);
      alert(error instanceof Error ? error.message : 'Ошибка при добавлении в избранное');
    }
  };

  return {
    handleAddToFavorites,
    handleFavoriteSubmit,
    handleClientLogin,
    handleLogout,
    handleRemoveFromFavorites,
    handleFavoritesFolderSelect,
    loadClientFavorites
  };
}