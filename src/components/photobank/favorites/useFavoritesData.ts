import { useState, useEffect } from 'react';

interface ClientData {
  client_id: number;
  full_name: string;
  phone: string;
  email?: string;
  photos: Array<{
    photo_id: number;
    added_at?: string;
  }>;
}

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
}

export function useFavoritesData(folderId: number | null, userId: number) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      await loadPhotos();
      await loadFavorites();
    };
    init();
  }, [folderId]);

  const loadPhotos = async () => {
    if (!folderId) {
      return;
    }
    
    try {
      const response = await fetch(
        `https://functions.poehali.dev/647801b3-1db8-4ded-bf80-1f278b3b5f94?action=list_photos&folder_id=${folderId}`,
        { headers: { 'X-User-Id': userId.toString() } }
      );
      const result = await response.json();
      
      if (response.ok) {
        const photos = (result.photos || []).map((photo: Photo) => ({
          ...photo,
          thumbnail_url: photo.thumbnail_url || photo.photo_url
        }));
        
        setAllPhotos(photos);
        console.log('[FAVORITES] Loaded', photos.length, 'photos with presigned URLs');
        console.log('[FAVORITES] Sample photo URLs:', photos.slice(0, 2).map(p => ({
          id: p.id,
          file: p.file_name,
          thumb: p.thumbnail_url,
          full: p.photo_url
        })));
      }
    } catch (e) {
      console.error('[FAVORITES] Failed to load photos:', e);
    }
  };

  const loadFavorites = async () => {
    setLoading(true);
    setError('');
    
    if (!folderId) {
      console.log('[FAVORITES] No folder selected, showing message');
      setError('Выберите папку клиента, чтобы увидеть избранные фото');
      setLoading(false);
      return;
    }
    
    const galleryCode = localStorage.getItem(`folder_${folderId}_gallery_code`);
    console.log('[FAVORITES] Gallery code:', galleryCode);
    
    if (!galleryCode) {
      setError('Галерея не опубликована. Сначала поделитесь папкой с клиентом.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723?gallery_code=${galleryCode}`
      );
      
      const result = await response.json();
      console.log('[FAVORITES] Clients API response:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка загрузки избранного');
      }
      
      const clients = result.clients || [];
      console.log('[FAVORITES] Loaded clients:', clients.length);
      clients.forEach((client: ClientData) => {
        console.log('[FAVORITES] Client:', {
          name: client.full_name,
          photoIds: client.photos.map(p => p.photo_id)
        });
      });
      
      setClients(clients);
    } catch (e) {
      console.error('[FAVORITES] Failed to load favorites:', e);
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSinglePhoto = async (photo: Photo) => {
    try {
      console.log('[FAVORITES] Downloading photo:', photo.photo_url);
      const urlParts = photo.photo_url.split('/bucket/');
      let s3_key = urlParts[1] || photo.photo_url.split('/').slice(-3).join('/');
      s3_key = s3_key.split('?')[0];
      console.log('[FAVORITES] Extracted s3_key:', s3_key);
      
      const isLargeFile = photo.file_name.toUpperCase().endsWith('.CR2') || 
                         photo.file_name.toUpperCase().endsWith('.NEF') ||
                         photo.file_name.toUpperCase().endsWith('.ARW');
      
      const response = await fetch(
        `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?s3_key=${encodeURIComponent(s3_key)}${isLargeFile ? '&presigned=true' : ''}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[FAVORITES] Download error:', errorData);
        throw new Error(errorData.error || 'Ошибка скачивания');
      }

      if (isLargeFile) {
        const data = await response.json();
        const a = document.createElement('a');
        a.href = data.download_url;
        a.download = photo.file_name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = photo.file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('[FAVORITES] Download failed:', e);
      alert('Ошибка при скачивании фото: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    }
  };

  const handleDownloadClientPhotos = async (client: ClientData) => {
    const displayPhotos = client.photos
      .map(fp => allPhotos.find(p => p.id === fp.photo_id))
      .filter((p): p is Photo => p !== undefined);

    if (displayPhotos.length === 0) {
      alert('Нет фото для скачивания');
      return;
    }

    try {
      const { ZipWriter, BlobWriter, HttpReader } = await import('@zip.js/zip.js');
      const zipWriter = new ZipWriter(new BlobWriter('application/zip'));

      for (const photo of displayPhotos) {
        try {
          const urlParts = photo.photo_url.split('/bucket/');
          let s3_key = urlParts[1] || photo.photo_url.split('/').slice(-3).join('/');
          s3_key = s3_key.split('?')[0];
          
          const proxyUrl = `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?s3_key=${encodeURIComponent(s3_key)}`;
          
          await zipWriter.add(photo.file_name, new HttpReader(proxyUrl));
        } catch (photoError) {
          console.error(`Failed to add ${photo.file_name} to archive:`, photoError);
        }
      }

      const blob = await zipWriter.close();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.full_name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Download failed:', e);
      alert('Ошибка при скачивании архива');
    }
  };

  return {
    clients,
    allPhotos,
    loading,
    error,
    handleDownloadSinglePhoto,
    handleDownloadClientPhotos
  };
}

export type { ClientData, Photo };
