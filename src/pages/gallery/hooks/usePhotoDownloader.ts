import { useState } from 'react';
import JSZip from 'jszip';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
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
      const response = await fetch(photo.photo_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Ошибка скачивания:', err);
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
      const zip = new JSZip();

      setDownloadProgress({ show: true, current: 0, total: totalFiles, status: 'downloading' });

      const BATCH_SIZE = 5;
      for (let i = 0; i < data.files.length; i += BATCH_SIZE) {
        if (abortController.signal.aborted) {
          break;
        }

        const batch = data.files.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (file: any) => {
          try {
            const fileResponse = await fetch(file.url, { signal: abortController.signal });
            if (!fileResponse.ok) return null;
            const blob = await fileResponse.blob();
            return { filename: file.filename, blob };
          } catch (err: any) {
            if (err.name === 'AbortError') return null;
            console.error('Ошибка загрузки файла:', file.filename, err);
            return null;
          }
        });

        const results = await Promise.all(batchPromises);
        results.forEach(result => {
          if (result) {
            zip.file(result.filename, result.blob);
          }
        });

        setDownloadProgress({ 
          show: true, 
          current: Math.min(i + BATCH_SIZE, totalFiles), 
          total: totalFiles, 
          status: 'downloading' 
        });
      }

      if (abortController.signal.aborted) {
        if (writable) {
          try {
            await writable.abort();
          } catch {}
        }
        setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
        setDownloadingAll(false);
        return;
      }

      setDownloadProgress({ show: true, current: totalFiles, total: totalFiles, status: 'completed' });

      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        streamFiles: true
      });

      if (supportsFileSystemAccess && writable) {
        try {
          await writable.write(zipBlob);
          await writable.close();
        } catch (err) {
          console.error('Ошибка записи файла:', err);
          try {
            await writable.abort();
          } catch {}
          throw err;
        }
      } else {
        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${folderName || 'gallery'}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(zipUrl);
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