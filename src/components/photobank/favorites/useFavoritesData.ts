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
      // Используем photos-presigned для получения свежих presigned URLs (не истекают)
      const response = await fetch(
        `https://functions.poehali.dev/647801b3-1db8-4ded-bf80-1f278b3b5f94?action=list_photos&folder_id=${folderId}`,
        { headers: { 'X-User-Id': userId.toString() } }
      );
      const result = await response.json();
      
      if (response.ok) {
        const photos = (result.photos || []).map((photo: Photo) => ({
          ...photo,
          // Убеждаемся что есть thumbnail_url
          thumbnail_url: photo.thumbnail_url || photo.photo_url
        }));
        
        setAllPhotos(photos);
        console.log('[FAVORITES] Loaded', photos.length, 'photos with FRESH presigned URLs');
        console.log('[FAVORITES] Sample photo URLs:', photos.slice(0, 2).map(p => ({
          id: p.id,
          file: p.file_name,
          thumb: p.thumbnail_url?.substring(0, 80) + '...',
          full: p.photo_url?.substring(0, 80) + '...'
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
      console.log('[FAVORITES] Downloading photo id:', photo.id, photo.file_name);

      const isLargeFile = photo.file_name.toUpperCase().endsWith('.CR2') ||
                         photo.file_name.toUpperCase().endsWith('.NEF') ||
                         photo.file_name.toUpperCase().endsWith('.ARW');

      // Передаём photo_id — бэк сам достанет s3_key из БД.
      // Парсинг URL на фронте ненадёжен: Yandex presigned URL имеет
      // другую структуру и s3_key восстанавливается некорректно.
      const response = await fetch(
        `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?photo_id=${photo.id}${isLargeFile ? '&presigned=true' : ''}`
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

    const suggestedName = `${client.full_name}.zip`.replace(/[\\/:*?"<>|]/g, '_');
    const proxyBase = 'https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215';

    // 1) СОВРЕМЕННЫЙ ПУТЬ: showSaveFilePicker — диалог открывается СРАЗУ,
    // а файлы скачиваются и пишутся в архив уже после выбора места.
    // Поддерживается в Chrome/Edge/Opera (desktop).
    const showSaveFilePicker = (window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName?: string;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker;

    if (typeof showSaveFilePicker === 'function') {
      let fileHandle: FileSystemFileHandle | undefined;
      try {
        fileHandle = await showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: 'ZIP архив',
              accept: { 'application/zip': ['.zip'] },
            },
          ],
        });
      } catch (pickerError) {
        const err = pickerError as { name?: string };
        if (err?.name === 'AbortError') return;
        console.error('[FAVORITES] showSaveFilePicker failed:', pickerError);
      }

      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          const { ZipWriter, HttpReader } = await import('@zip.js/zip.js');
          const zipWriter = new ZipWriter(writable);

          for (const photo of displayPhotos) {
            try {
              const proxyUrl = `${proxyBase}?photo_id=${photo.id}`;
              await zipWriter.add(photo.file_name, new HttpReader(proxyUrl));
            } catch (photoError) {
              console.error(`Failed to add ${photo.file_name} to archive:`, photoError);
            }
          }

          await zipWriter.close();
          return;
        } catch (e) {
          console.error('[FAVORITES] Streamed archive failed:', e);
          alert('Ошибка при записи архива');
          return;
        }
      }
    }

    // 2) ФОЛБЭК для Safari/Firefox: собираем архив в памяти, потом скачиваем.
    try {
      const { ZipWriter, BlobWriter, HttpReader } = await import('@zip.js/zip.js');
      const zipWriter = new ZipWriter(new BlobWriter('application/zip'));

      for (const photo of displayPhotos) {
        try {
          const proxyUrl = `${proxyBase}?photo_id=${photo.id}`;
          await zipWriter.add(photo.file_name, new HttpReader(proxyUrl));
        } catch (photoError) {
          console.error(`Failed to add ${photo.file_name} to archive:`, photoError);
        }
      }

      const blob = await zipWriter.close();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
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