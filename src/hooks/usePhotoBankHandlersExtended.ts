import { useState } from 'react';
import JSZip from 'jszip';

interface TechSortProgress {
  open: boolean;
  progress: number;
  currentFile: string;
  processedCount: number;
  totalCount: number;
  rejectedCount: number;
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
  folder_type?: 'originals' | 'tech_rejects';
  parent_folder_id?: number | null;
}

export const usePhotoBankHandlersExtended = (
  userId: string | null,
  folders: PhotoFolder[],
  selectedFolder: PhotoFolder | null,
  setLoading: (loading: boolean) => void,
  startTechSort: (folderId: number, resetAnalysis?: boolean, onProgress?: (processed: number, total: number, rejected: number) => void) => Promise<any>,
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
    rejectedCount: 0,
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

    
    // Проверяем, есть ли уже результаты анализа (все фото проанализированы)
    const folder = folders.find(f => f.id === folderId);
    const totalPhotos = folder?.photo_count || 0;
    
    // Ищем папку tech_rejects для проверки, был ли уже анализ
    const techRejectsFolder = folders.find(
      f => f.parent_folder_id === folderId && f.folder_type === 'tech_rejects'
    );
    

    
    let resetAnalysis = false;
    let confirmMessage = 
      `Запустить автоматическую сортировку фото в папке "${folderName}"?\n\n` +
      `Фото с техническим браком будут перемещены в отдельную подпапку.\n\n` +
      `Это может занять несколько минут в зависимости от количества фото.`;
    
    // Если папка tech_rejects существует (даже если пустая) - это значит анализ уже был
    if (techRejectsFolder) {
      const rejectsCount = techRejectsFolder.photo_count || 0;
      confirmMessage = 
        rejectsCount > 0
          ? `Анализ уже выполнялся для этой папки (найдено ${rejectsCount} браков).\n\n` +
            `Запустить повторный анализ всех фото?\n\n` +
            `ВНИМАНИЕ: Все фото будут заново проанализированы с учётом улучшенного алгоритма детекции глаз.`
          : `Анализ уже выполнялся для этой папки (технический брак не найден).\n\n` +
            `Запустить повторный анализ всех фото?\n\n` +
            `ВНИМАНИЕ: Все фото будут заново проанализированы с учётом улучшенного алгоритма детекции глаз.`;
      resetAnalysis = true;
    }
    
    const confirmed = window.confirm(confirmMessage);
    
    if (!confirmed) {
      return;
    }

    if (totalPhotos === 0) {
      return;
    }

    setTechSortProgress({
      open: true,
      progress: 0,
      currentFile: 'Подготовка...',
      processedCount: 0,
      totalCount: totalPhotos,
      rejectedCount: 0,
      status: 'analyzing',
      errorMessage: ''
    });

    try {
      const result = await startTechSort(
        folderId, 
        resetAnalysis,
        (processed, total, rejected) => {
          // Реальный прогресс от backend
          const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;
          
          setTechSortProgress({
            open: true,
            progress: progressPercent,
            currentFile: processed < total 
              ? `Анализ фото ${processed + 1} из ${total}...` 
              : 'Завершение...',
            processedCount: processed,
            totalCount: total,
            rejectedCount: rejected,
            status: 'analyzing',
            errorMessage: ''
          });
        }
      );
      
      setTechSortProgress({
        open: true,
        progress: 100,
        currentFile: '',
        processedCount: result.processed,
        totalCount: result.processed,
        rejectedCount: result.rejected,
        status: 'completed',
        errorMessage: ''
      });

      await fetchFolders();

      setTimeout(() => {
        setTechSortProgress(prev => ({ ...prev, open: false }));
      }, 2000);

    } catch (error: any) {
      setTechSortProgress({
        open: true,
        progress: 0,
        currentFile: '',
        processedCount: 0,
        totalCount: totalPhotos,
        rejectedCount: 0,
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
      const result = await restorePhoto(photoId);
      
      if (selectedFolder) {
        await fetchPhotos(selectedFolder.id);
      }
      await fetchFolders();

      if (result?.cleaned) {

      }
    } catch (error) {

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
  
            continue;
          }
          const blob = await fileResponse.blob();
          zip.file(file.filename, blob);
        } catch (err) {

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

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);

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