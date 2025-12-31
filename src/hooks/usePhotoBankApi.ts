import { useToast } from '@/hooks/use-toast';

const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
const PHOTOBANK_TRASH_API = 'https://functions.poehali.dev/d2679e28-52e9-417d-86d7-f508a013bf7d';
const STORAGE_API = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  data_url?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export const usePhotoBankApi = (
  userId: string,
  setFolders: (folders: PhotoFolder[]) => void,
  setPhotos: (photos: Photo[]) => void,
  setLoading: (loading: boolean) => void,
  setStorageUsage: (usage: { usedGb: number; limitGb: number; percent: number }) => void
) => {
  const { toast } = useToast();

  const fetchFolders = async () => {
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
  };

  const fetchPhotos = async (folderId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list_photos&folder_id=${folderId}`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить фотографии',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageUsage = async () => {
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
  };

  return {
    fetchFolders,
    fetchPhotos,
    fetchStorageUsage,
    PHOTOBANK_FOLDERS_API,
    PHOTOBANK_TRASH_API
  };
};