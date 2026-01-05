import { useState } from 'react';
import JSZip from 'jszip';

interface TechSortProgress {
  open: boolean;
  progress: number;
  currentFile: string;
  processedCount: number;
  totalCount: number;
  status: 'analyzing' | 'completed' | 'error';
  errorMessage: string;
}

interface DownloadProgress {
  open: boolean;
  folderName: string;
  progress: number;
  currentFile: string;
  downloadedFiles: number;
  totalFiles: number;
  status: 'preparing' | 'downloading' | 'completed' | 'error';
  errorMessage: string;
}

interface PhotoFolder {
  id: number;
  folder_name: string;
  photo_count: number;
}

export const usePhotoBankHandlersExtended = (
  userId: string | null,
  folders: PhotoFolder[],
  selectedFolder: PhotoFolder | null,
  setLoading: (loading: boolean) => void,
  startTechSort: (folderId: number) => Promise<any>,
  restorePhoto: (photoId: number) => Promise<void>,
  fetchFolders: () => Promise<any>,
  fetchPhotos: (folderId: number) => Promise<void>
) => {
  const [techSortProgress, setTechSortProgress] = useState<TechSortProgress>({
    open: false,
    progress: 0,
    currentFile: '',
    processedCount: 0,
    totalCount: 0,
    status: 'analyzing',
    errorMessage: ''
  });

  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    open: false,
    folderName: '',
    progress: 0,
    currentFile: '',
    downloadedFiles: 0,
    totalFiles: 0,
    status: 'preparing',
    errorMessage: ''
  });

  const handleStartTechSort = async (folderId: number, folderName: string) => {
    const confirmed = window.confirm(
      `Запустить автоматическую сортировку фото в папке "${folderName}"?\n\n` +
      `Фото с техническим браком будут перемещены в отдельную подпапку.\n\n` +
      `Это может занять несколько минут в зависимости от количества фото.`
    );
    
    if (!confirmed) {
      return;
    }

    const folder = folders.find(f => f.id === folderId);
    const totalPhotos = folder?.photo_count || 0;

    if (totalPhotos === 0) {
      return;
    }

    setTechSortProgress({
      open: true,
      progress: 0,
      currentFile: 'Подготовка...',
      processedCount: 0,
      totalCount: totalPhotos,
      status: 'analyzing',
      errorMessage: ''
    });

    const estimatedTimeMs = totalPhotos * 2000;
    const updateInterval = 100;
    const incrementPerUpdate = (100 / (estimatedTimeMs / updateInterval));
    
    let currentProgress = 0;
    let processedFiles = 0;

    const progressInterval = setInterval(() => {
      currentProgress += incrementPerUpdate;
      processedFiles = Math.floor((currentProgress / 100) * totalPhotos);
      
      if (currentProgress >= 95) {
        clearInterval(progressInterval);
        currentProgress = 95;
      }

      setTechSortProgress(prev => ({
        ...prev,
        progress: currentProgress,
        processedCount: processedFiles,
        currentFile: `Анализ фото ${processedFiles + 1} из ${totalPhotos}...`
      }));
    }, updateInterval);

    try {
      const result = await startTechSort(folderId);
      
      clearInterval(progressInterval);
      
      setTechSortProgress({
        open: true,
        progress: 100,
        currentFile: '',
        processedCount: result.processed || totalPhotos,
        totalCount: totalPhotos,
        status: 'completed',
        errorMessage: ''
      });

      await fetchFolders();

      setTimeout(() => {
        setTechSortProgress(prev => ({ ...prev, open: false }));
      }, 2000);

    } catch (error: any) {
      clearInterval(progressInterval);
      
      setTechSortProgress({
        open: true,
        progress: 0,
        currentFile: '',
        processedCount: 0,
        totalCount: totalPhotos,
        status: 'error',
        errorMessage: error.message || 'Произошла ошибка при анализе'
      });

      setTimeout(() => {
        setTechSortProgress(prev => ({ ...prev, open: false }));
      }, 3000);
    }
  };

  const handleRestorePhoto = async (photoId: number) => {
    setLoading(true);
    try {
      await restorePhoto(photoId);
      if (selectedFolder) {
        await fetchPhotos(selectedFolder.id);
      }
      await fetchFolders();
    } catch (error) {
      console.error('Failed to restore photo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFolder = async (folderId: number, folderName: string) => {
    const confirmed = window.confirm(
      `Скачать все фотографии из папки "${folderName}" архивом?\n\n` +
      `Файлы будут упакованы в ZIP-архив. Это может занять некоторое время.`
    );
    
    if (!confirmed) {
      return;
    }

    setDownloadProgress({
      open: true,
      folderName,
      progress: 0,
      currentFile: '',
      downloadedFiles: 0,
      totalFiles: 0,
      status: 'preparing',
      errorMessage: ''
    });

    try {
      const response = await fetch(
        `https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a?folderId=${folderId}&userId=${userId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to get file list');
      }
      
      const data = await response.json();
      const files = data.files || [];
      const totalFiles = files.length;

      if (totalFiles === 0) {
        throw new Error('No files to download');
      }

      setDownloadProgress(prev => ({
        ...prev,
        status: 'downloading',
        totalFiles
      }));

      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        setDownloadProgress(prev => ({
          ...prev,
          currentFile: file.filename,
          downloadedFiles: i,
          progress: (i / totalFiles) * 90
        }));

        try {
          const fileResponse = await fetch(file.url);
          if (!fileResponse.ok) {
            console.error(`Failed to fetch ${file.filename}`);
            continue;
          }
          const blob = await fileResponse.blob();
          zip.file(file.filename, blob);
        } catch (err) {
          console.error(`Failed to download ${file.filename}:`, err);
        }
      }

      setDownloadProgress(prev => ({
        ...prev,
        currentFile: 'Создание архива...',
        progress: 95
      }));

      const zipBlob = await zip.generateAsync({ type: 'blob' });

      setDownloadProgress(prev => ({
        ...prev,
        currentFile: 'Сохранение файла...',
        progress: 98
      }));

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${folderName}.zip`,
            types: [{
              description: 'ZIP Archive',
              accept: {
                'application/zip': ['.zip']
              }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(zipBlob);
          await writable.close();
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setDownloadProgress(prev => ({ ...prev, open: false }));
            return;
          }
          throw err;
        }
      } else {
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${folderName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setDownloadProgress(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        downloadedFiles: totalFiles
      }));

      setTimeout(() => {
        setDownloadProgress(prev => ({ ...prev, open: false }));
      }, 2000);

    } catch (error: any) {
      console.error('Failed to download folder:', error);
      setDownloadProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message || 'Ошибка при создании архива'
      }));

      setTimeout(() => {
        setDownloadProgress(prev => ({ ...prev, open: false }));
      }, 3000);
    }
  };

  return {
    techSortProgress,
    downloadProgress,
    handleStartTechSort,
    handleRestorePhoto,
    handleDownloadFolder
  };
};