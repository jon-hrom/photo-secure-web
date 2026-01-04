import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
const PHOTOBANK_TRASH_API = 'https://functions.poehali.dev/d2679e28-52e9-417d-86d7-f508a013bf7d';
const STORAGE_API = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';
const PHOTO_TECH_SORT_API = 'https://functions.poehali.dev/85953b37-509d-4868-bf56-344c1be62404';
const PHOTO_RESTORE_API = 'https://functions.poehali.dev/59a23b36-2a1c-49ac-876f-48f8cbac20cf';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  folder_type?: 'originals' | 'tech_rejects';
  parent_folder_id?: number | null;
}

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  s3_key?: string;
  data_url?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  tech_reject_reason?: string | null;
  tech_analyzed?: boolean;
}

export const usePhotoBankApi = (
  userId: string,
  setFolders: (folders: PhotoFolder[]) => void,
  setPhotos: (photos: Photo[]) => void,
  setLoading: (loading: boolean) => void,
  setStorageUsage: (usage: { usedGb: number; limitGb: number; percent: number }) => void
) => {
  const { toast } = useToast();

  const fetchFolders = useCallback(async () => {
    console.log('[FETCH_FOLDERS] Starting fetch with userId:', userId);
    setLoading(true);
    try {
      const url = `${PHOTOBANK_FOLDERS_API}?action=list`;
      console.log('[FETCH_FOLDERS] Fetching from:', url);
      
      const res = await fetch(url, {
        headers: { 'X-User-Id': userId }
      });
      
      console.log('[FETCH_FOLDERS] Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[FETCH_FOLDERS] Error response:', errorText);
        throw new Error(`API returned ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      console.log('[FETCH_FOLDERS] Received data:', data);
      console.log('[FETCH_FOLDERS] Folders count:', data.folders?.length || 0);
      
      setFolders(data.folders || []);
    } catch (error: any) {
      console.error('[FETCH_FOLDERS] Error:', error);
      toast({
        title: 'Ошибка',
        description: `Не удалось загрузить папки: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [userId, setFolders, setLoading, toast]);

  const fetchPhotos = useCallback(async (folderId: number) => {
    console.log('[FETCH_PHOTOS] Starting fetch for folder:', folderId);
    setLoading(true);
    try {
      const url = `${PHOTOBANK_FOLDERS_API}?action=list_photos&folder_id=${folderId}`;
      console.log('[FETCH_PHOTOS] Fetching from:', url);
      
      const res = await fetch(url, {
        headers: { 'X-User-Id': userId }
      });
      
      console.log('[FETCH_PHOTOS] Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[FETCH_PHOTOS] Error response:', errorText);
        throw new Error(`API returned ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      console.log('[FETCH_PHOTOS] Received data:', data);
      console.log('[FETCH_PHOTOS] Photos count:', data.photos?.length || 0);
      
      setPhotos(data.photos || []);
    } catch (error: any) {
      console.error('[FETCH_PHOTOS] Error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить фотографии',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [userId, setPhotos, setLoading, toast]);

  const fetchStorageUsage = useCallback(async () => {
    try {
      const res = await fetch(`${STORAGE_API}?action=usage`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setStorageUsage({
        usedGb: data.usedGb || 0,
        limitGb: data.limitGb || 5,
        percent: data.percent || 0
      });
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
    }
  }, [userId, setStorageUsage]);

  const startTechSort = async (folderId: number) => {
    try {
      const res = await fetch(PHOTO_TECH_SORT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ folder_id: folderId })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API returned ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      toast({
        title: 'Сортировка завершена',
        description: `Обработано ${data.processed} фото, найдено ${data.rejected} технических браков`,
        duration: 5000
      });

      return data;
    } catch (error: any) {
      console.error('[TECH_SORT] Error:', error);
      toast({
        title: 'Ошибка',
        description: `Не удалось выполнить сортировку: ${error.message}`,
        variant: 'destructive'
      });
      throw error;
    }
  };

  const restorePhoto = async (photoId: number) => {
    try {
      const res = await fetch(PHOTO_RESTORE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ photo_id: photoId })
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        // Обработка случая когда файл удалён из базы (автоочистка)
        if (res.status === 404 && errorData.cleaned) {
          toast({
            title: 'Запись удалена',
            description: 'Файл не найден в хранилище и удалён из базы данных',
            duration: 3000
          });
          return { cleaned: true, photo_id: photoId };
        }

        throw new Error(`API returned ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      toast({
        title: 'Фото восстановлено',
        description: 'Фото успешно перемещено в оригиналы',
        duration: 3000
      });

      return data;
    } catch (error: any) {
      console.error('[PHOTO_RESTORE] Error:', error);
      toast({
        title: 'Ошибка',
        description: `Не удалось восстановить фото: ${error.message}`,
        variant: 'destructive'
      });
      throw error;
    }
  };

  return {
    fetchFolders,
    fetchPhotos,
    fetchStorageUsage,
    startTechSort,
    restorePhoto,
    PHOTOBANK_FOLDERS_API,
    PHOTOBANK_TRASH_API,
    PHOTO_TECH_SORT_API,
    PHOTO_RESTORE_API
  };
};