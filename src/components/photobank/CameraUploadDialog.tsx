import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useCameraUploadLogic } from './camera-upload/CameraUploadLogic';
import CameraUploadFileList from './camera-upload/CameraUploadFileList';
import FileSelectionControls from './camera-upload/FileSelectionControls';
import FolderSelection from './camera-upload/FolderSelection';
import DateFilter from './camera-upload/DateFilter';
import UploadControls from './camera-upload/UploadControls';
import { 
  FileUploadStatus, 
  CameraUploadDialogProps 
} from './camera-upload/CameraUploadTypes';
import exifr from 'exifr';
import CameraAccess from '@/plugins/cameraAccess';

const CameraUploadDialog = ({ open, onOpenChange, userId, folders, onUploadComplete }: CameraUploadDialogProps) => {
  const [files, setFiles] = useState<FileUploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [folderMode, setFolderMode] = useState<'new' | 'existing'>('new');
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<FileUploadStatus[]>([]);

  const {
    isOnline,
    retryFailedUploads,
    handleUploadProcess,
    abortControllersRef
  } = useCameraUploadLogic(userId, uploading, setFiles, filesRef, setUploading);

  useEffect(() => {
    if (open) {
      const now = new Date();
      const defaultName = `Загрузка ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      setFolderName(defaultName);
      setFolderMode('new');
      setSelectedFolderId(null);
      setSelectedDate(null);
      setAvailableDates([]);
    }
  }, [open]);

  const processFiles = async (fileList: File[]) => {
    const newFilesPromises = fileList.map(async (file) => {
      let captureDate: Date | undefined;
      try {
        const exifData = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] });
        if (exifData?.DateTimeOriginal) {
          captureDate = new Date(exifData.DateTimeOriginal);
        } else if (exifData?.CreateDate) {
          captureDate = new Date(exifData.CreateDate);
        }
      } catch (err) {
        captureDate = new Date(file.lastModified);
      }

      if (!captureDate || isNaN(captureDate.getTime())) {
        captureDate = new Date(file.lastModified);
      }

      return {
        file,
        status: 'pending' as const,
        progress: 0,
        captureDate,
        selected: false,
      };
    });

    const newFiles = await Promise.all(newFilesPromises);

    setFiles(prev => {
      const updated = [...prev, ...newFiles];
      filesRef.current = updated;

      const dates = new Set<string>();
      updated.forEach(f => {
        if (f.captureDate) {
          const dateStr = f.captureDate.toLocaleDateString('ru-RU');
          dates.add(dateStr);
        }
      });
      setAvailableDates(Array.from(dates).sort());

      return updated;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    await processFiles(selectedFiles);
  };

  const handleScanDates = async () => {
    try {
      toast.info('Сканирование дат с камеры...');
      const result = await CameraAccess.getAvailableDates();
      
      if (result.dates && result.dates.length > 0) {
        const formattedDates = result.dates.map(dateStr => {
          const [year, month, day] = dateStr.split('-');
          return `${day}.${month}.${year}`;
        });
        
        setAvailableDates(formattedDates);
        toast.success(`Найдено ${result.dates.length} дат с фотографиями`);
      } else {
        toast.info('Фото с датами не найдены');
      }
    } catch (error) {
      console.error('Ошибка сканирования дат:', error);
      toast.error('Ошибка сканирования дат с камеры');
    }
  };

  const handleNativeFilePicker = async () => {
    try {
      let filterDate: string | undefined;
      
      if (selectedDate) {
        const [day, month, year] = selectedDate.split('.');
        filterDate = `${year}-${month}-${day}`;
      }
      
      const result = await CameraAccess.pickFiles(filterDate ? { filterDate } : undefined);
      
      const files = result.files.map(fileData => {
        const byteString = atob(fileData.data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        
        const blob = new Blob([uint8Array], { type: fileData.type });
        return new File([blob], fileData.name, { type: fileData.type });
      });

      await processFiles(files);
      
      if (selectedDate) {
        toast.success(`Загружено ${files.length} фото за ${selectedDate}`);
      } else {
        toast.success(`Выбрано файлов: ${files.length}`);
      }
    } catch (error) {
      console.error('Ошибка выбора файлов:', error);
      toast.error('Ошибка выбора файлов');
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Выберите файлы для загрузки');
      return;
    }

    if (folderMode === 'new' && !folderName.trim()) {
      toast.error('Введите название папки');
      return;
    }

    if (folderMode === 'existing' && !selectedFolderId) {
      toast.error('Выберите папку');
      return;
    }

    console.log('[CAMERA_UPLOAD] Starting upload with', files.length, 'files');
    setUploading(true);

    await handleUploadProcess(
      folderMode,
      folderName,
      selectedFolderId,
      onUploadComplete,
      onOpenChange
    );
  };

  const handleCancel = () => {
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
    setFiles([]);
    setUploading(false);
    onOpenChange(false);
  };

  const totalFiles = files.length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const selectedCount = files.filter(f => f.selected).length;
  const skippedCount = files.filter(f => f.status === 'skipped').length;
  const filteredCount = selectedDate ? files.filter(f => {
    const dateStr = f.captureDate?.toLocaleDateString('ru-RU');
    return dateStr === selectedDate;
  }).length : 0;

  const handleSelectAll = () => {
    setFiles(prev => {
      const updated = prev.map(f => ({ ...f, selected: true }));
      filesRef.current = updated;
      return updated;
    });
  };

  const handleDeselectAll = () => {
    setFiles(prev => {
      const updated = prev.map(f => ({ ...f, selected: false }));
      filesRef.current = updated;
      return updated;
    });
  };

  const handleToggleFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], selected: !updated[index].selected };
      filesRef.current = updated;
      return updated;
    });
  };

  const handleDeleteSelected = () => {
    setFiles(prev => {
      const updated = prev.filter(f => !f.selected);
      filesRef.current = updated;
      return updated;
    });
  };

  const handleNativeCapture = async (cdnUrl: string, fileName: string) => {
    const newFile: FileUploadStatus = {
      file: new File([], fileName),
      status: 'success',
      progress: 100,
      captureDate: new Date(),
      selected: false,
      cdnUrl
    };
    
    setFiles(prev => {
      const updated = [...prev, newFile];
      filesRef.current = updated;
      
      const dates = new Set<string>();
      updated.forEach(f => {
        if (f.captureDate) {
          const dateStr = f.captureDate.toLocaleDateString('ru-RU');
          dates.add(dateStr);
        }
      });
      setAvailableDates(Array.from(dates).sort());
      
      return updated;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Загрузить фото/видео</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <FileSelectionControls
            fileInputRef={fileInputRef}
            uploading={uploading}
            userId={userId}
            onFileSelect={handleFileSelect}
            onScanDates={handleScanDates}
            onNativeFilePicker={handleNativeFilePicker}
            onNativeCapture={handleNativeCapture}
          />

          <FolderSelection
            folderMode={folderMode}
            folderName={folderName}
            selectedFolderId={selectedFolderId}
            folders={folders}
            uploading={uploading}
            onFolderModeChange={setFolderMode}
            onFolderNameChange={setFolderName}
            onFolderSelect={setSelectedFolderId}
          />

          <DateFilter
            selectedDate={selectedDate}
            availableDates={availableDates}
            filteredCount={filteredCount}
            uploading={uploading}
            onDateSelect={setSelectedDate}
          />

          <CameraUploadFileList
            files={files}
            uploading={uploading}
            selectedDate={selectedDate}
            onToggleFile={handleToggleFile}
          />

          <UploadControls
            uploading={uploading}
            isOnline={isOnline}
            totalFiles={totalFiles}
            successCount={successCount}
            errorCount={errorCount}
            pendingCount={pendingCount}
            selectedCount={selectedCount}
            skippedCount={skippedCount}
            onUpload={handleUpload}
            onCancel={handleCancel}
            onRetryFailed={retryFailedUploads}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraUploadDialog;
