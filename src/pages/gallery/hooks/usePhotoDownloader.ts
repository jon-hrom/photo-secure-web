import { useState } from 'react';
import * as zip from '@zip.js/zip.js';
import { saveBlobToDevice, isIOS, savePhotosToGallery } from '@/utils/savePhoto';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
  folder_id?: number;
}

interface DownloadProgress {
  show: boolean;
  current: number;
  total: number;
  status: 'preparing' | 'downloading' | 'completed';
}

export function usePhotoDownloader(code?: string, password?: string, folderName?: string) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    show: false,
    current: 0,
    total: 0,
    status: 'preparing'
  });
  const [downloadAbortController, setDownloadAbortController] = useState<AbortController | null>(null);

  const downloadPhoto = async (photo: Photo) => {
    try {
      if (!photo.s3_key) {
        throw new Error('Отсутствует информация о файле');
      }

      // Всегда берём ссылку на файл: отдача самого файла через функцию
      // ограничена ~3.5 МБ, а обычное фото с камеры весит больше.
      const params = new URLSearchParams({
        s3_key: photo.s3_key,
        photo_id: photo.id.toString(),
        presigned: 'true',
        ...(photo.folder_id && { folder_id: photo.folder_id.toString() }),
      });
      const apiUrl = `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?${params.toString()}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка скачивания файла');
      }

      const data = await response.json();
      if (!data.download_url) throw new Error('Ссылка на файл не получена');
      const fileResponse = await fetch(data.download_url);
      if (!fileResponse.ok) throw new Error(`HTTP ${fileResponse.status}`);
      const blob = await fileResponse.blob();

      await saveBlobToDevice(blob, photo.file_name);
    } catch (err) {
      console.error('Ошибка скачивания:', err);
      alert('Ошибка при скачивании файла. Попробуйте ещё раз.');
    }
  };

  const cancelDownload = () => {
    if (downloadAbortController) {
      downloadAbortController.abort();
      setDownloadAbortController(null);
    }
    setDownloadingAll(false);
    setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    setDownloadProgress({ show: true, current: 0, total: 0, status: 'preparing' });
    
    const abortController = new AbortController();
    setDownloadAbortController(abortController);
    
    try {
      const supportsFileSystemAccess = 'showSaveFilePicker' in window;
      let fileHandle: any = null;
      let writable: any = null;

      if (supportsFileSystemAccess) {
        try {
          fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `${folderName || 'gallery'}.zip`,
            types: [{
              description: 'ZIP Archive',
              accept: { 'application/zip': ['.zip'] }
            }]
          });
          writable = await fileHandle.createWritable();
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
            setDownloadingAll(false);
            return;
          }
          throw err;
        }
      }
      
      const url = password 
        ? `https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a?code=${code}&password=${encodeURIComponent(password)}`
        : `https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a?code=${code}`;
      
      const response = await fetch(url, { signal: abortController.signal });
      const data = await response.json();
      
      if (!response.ok || !data.files) {
        throw new Error(data.error || 'Ошибка получения списка файлов');
      }

      const totalFiles = data.files.length;

      setDownloadProgress({ show: true, current: 0, total: totalFiles, status: 'downloading' });

      // На iPhone предлагаем сохранить снимки прямо в «Фото»,
      // чтобы клиенту не пришлось распаковывать архив на телефоне.
      if (isIOS() && !supportsFileSystemAccess) {
        try {
          const items: { blob: Blob; fileName: string }[] = [];
          for (let i = 0; i < data.files.length; i++) {
            if (abortController.signal.aborted) break;
            const file = data.files[i];
            try {
              const fileResponse = await fetch(file.url, { signal: abortController.signal });
              if (fileResponse.ok) {
                items.push({ blob: await fileResponse.blob(), fileName: file.filename });
              }
            } catch (err: any) {
              if (err.name === 'AbortError') break;
            }
            setDownloadProgress({ show: true, current: i + 1, total: totalFiles, status: 'downloading' });
          }

          if (!abortController.signal.aborted && await savePhotosToGallery(items)) {
            setDownloadProgress({ show: true, current: totalFiles, total: totalFiles, status: 'completed' });
            setTimeout(() => {
              setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
              setDownloadingAll(false);
              setDownloadAbortController(null);
            }, 5000);
            return;
          }
        } catch { /* соберём архив как обычно */ }
      }

      if (supportsFileSystemAccess && writable) {
        const zipWriter = new zip.ZipWriter(writable, { bufferedWrite: true, zip64: false });
        const usedFilenames = new Set<string>();

        for (let i = 0; i < data.files.length; i++) {
          if (abortController.signal.aborted) {
            await zipWriter.close();
            return;
          }

          const file = data.files[i];
          
          try {
            const fileResponse = await fetch(file.url, { signal: abortController.signal });
            if (fileResponse.ok && fileResponse.body) {
              let filename = file.filename;
              
              // Если файл с таким именем уже есть, добавляем счетчик
              if (usedFilenames.has(filename)) {
                const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
                const nameWithoutExt = ext ? filename.substring(0, filename.lastIndexOf('.')) : filename;
                let counter = 1;
                do {
                  filename = `${nameWithoutExt}_${counter}${ext}`;
                  counter++;
                } while (usedFilenames.has(filename));
              }
              
              usedFilenames.add(filename);
              await zipWriter.add(filename, fileResponse.body, { level: 0, dataDescriptor: false });
            }
          } catch (err: any) {
            if (err.name === 'AbortError') break;
            console.error('Ошибка загрузки файла:', file.filename, err);
          }

          setDownloadProgress({ 
            show: true, 
            current: i + 1, 
            total: totalFiles, 
            status: 'downloading' 
          });
        }

        if (abortController.signal.aborted) {
          try {
            await zipWriter.close();
          } catch {}
          setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
          setDownloadingAll(false);
          return;
        }

        await zipWriter.close();
        setDownloadProgress({ show: true, current: totalFiles, total: totalFiles, status: 'completed' });
      } else {
        const zipFileStream = new zip.BlobWriter();
        const zipWriter = new zip.ZipWriter(zipFileStream, { zip64: false });
        const usedFilenames = new Set<string>();

        for (let i = 0; i < data.files.length; i++) {
          if (abortController.signal.aborted) break;

          const file = data.files[i];
          
          try {
            const fileResponse = await fetch(file.url, { signal: abortController.signal });
            if (fileResponse.ok && fileResponse.body) {
              let filename = file.filename;
              
              if (usedFilenames.has(filename)) {
                const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
                const nameWithoutExt = ext ? filename.substring(0, filename.lastIndexOf('.')) : filename;
                let counter = 1;
                do {
                  filename = `${nameWithoutExt}_${counter}${ext}`;
                  counter++;
                } while (usedFilenames.has(filename));
              }
              
              usedFilenames.add(filename);
              await zipWriter.add(filename, fileResponse.body, { level: 0, dataDescriptor: false });
            }
          } catch (err: any) {
            if (err.name === 'AbortError') break;
            console.error('Ошибка загрузки файла:', file.filename, err);
          }

          setDownloadProgress({ 
            show: true, 
            current: i + 1, 
            total: totalFiles, 
            status: 'downloading' 
          });
        }

        const zipBlob = await zipWriter.close();

        if (!abortController.signal.aborted) {
          const zipUrl = URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = zipUrl;
          link.download = `${folderName || 'gallery'}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(zipUrl);
          setDownloadProgress({ show: true, current: totalFiles, total: totalFiles, status: 'completed' });
        } else {
          setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
          setDownloadingAll(false);
          return;
        }
      }
      
      setTimeout(() => {
        setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
        setDownloadingAll(false);
        setDownloadAbortController(null);
      }, 5000);
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Скачивание отменено пользователем');
        setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
        setDownloadingAll(false);
        setDownloadAbortController(null);
        return;
      }
      console.error('Ошибка скачивания:', err);
      alert('Ошибка: ' + err.message);
      setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
      setDownloadingAll(false);
      setDownloadAbortController(null);
    }
  };

  return {
    downloadingAll,
    downloadProgress,
    downloadPhoto,
    downloadAll,
    cancelDownload
  };
}