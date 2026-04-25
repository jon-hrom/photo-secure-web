import { useCallback, useEffect } from 'react';
import heic2any from 'heic2any';
import { useToast } from '@/hooks/use-toast';
import { ClientUploadFolder, UploadedPhoto } from './useClientUploadState';

const isHeicFile = (file: File) => {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'heic' || ext === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
};

const convertHeicToJpeg = async (file: File): Promise<File> => {
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }) as Blob;
  const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
};

const CLIENT_UPLOAD_URL = 'https://functions.poehali.dev/06dd3267-2ef6-45bc-899c-50f86e9d36e1';
const HEIC_CONVERT_URL = 'https://functions.poehali.dev/d7480573-de41-457c-a5cd-dffe681a591f';

interface UseClientUploadHandlersProps {
  shortCode: string;
  clientId: number;
  isOpen: boolean;
  initialFolderId?: number;
  initialFolderName?: string;
  existingFolders: ClientUploadFolder[];
  onFoldersUpdate: (folders: ClientUploadFolder[]) => void;

  newFolderName: string;
  clientName: string;
  activeFolderId: number | null;
  activeFolderName: string;
  renameValue: string;

  setStep: (step: 'folders' | 'create' | 'upload' | 'view' | 'rename') => void;
  setActiveFolderId: (id: number | null) => void;
  setActiveFolderName: (name: string) => void;
  setUploadedPhotos: React.Dispatch<React.SetStateAction<UploadedPhoto[]>>;
  setViewingOtherFolder: (v: boolean) => void;
  setRenamingFolder: (v: boolean) => void;
  setUploading: (v: boolean) => void;
  setUploadProgress: (p: { current: number; total: number }) => void;
  setDeletingPhotoId: (id: number | null) => void;
  setIsDragOver: (v: boolean) => void;
  setLoadingPhotos: (v: boolean) => void;
  setCheckingOwnFolder: (v: boolean) => void;

  handleFilesSelected: (files: FileList | null) => Promise<void>;
}

export function useClientUploadHandlers({
  shortCode,
  clientId,
  isOpen,
  initialFolderId,
  initialFolderName,
  existingFolders,
  onFoldersUpdate,
  newFolderName,
  clientName,
  activeFolderId,
  activeFolderName,
  renameValue,
  setStep,
  setActiveFolderId,
  setActiveFolderName,
  setUploadedPhotos,
  setViewingOtherFolder,
  setRenamingFolder,
  setUploading,
  setUploadProgress,
  setDeletingPhotoId,
  setIsDragOver,
  setLoadingPhotos,
  setCheckingOwnFolder,
  handleFilesSelected,
}: UseClientUploadHandlersProps) {
  const { toast } = useToast();

  const loadFolderPhotos = useCallback(async (folderId: number) => {
    setLoadingPhotos(true);
    try {
      const res = await fetch(CLIENT_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'client_list_photos',
          short_code: shortCode,
          client_id: clientId,
          upload_folder_id: folderId
        })
      });
      if (res.ok) {
        const data = await res.json();
        const photos = (data.photos || []).map((p: { photo_id: number; file_name: string; s3_url: string }) => ({
          photo_id: p.photo_id,
          file_name: p.file_name,
          s3_url: p.s3_url
        }));
        setUploadedPhotos(photos);
      }
    } catch (e) { void e; }
    setLoadingPhotos(false);
  }, [shortCode, clientId, setLoadingPhotos, setUploadedPhotos]);

  const handleSelectFolder = useCallback((folder: ClientUploadFolder) => {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.folder_name);
    setUploadedPhotos([]);
    setViewingOtherFolder(false);
    setStep('upload');
    loadFolderPhotos(folder.id);
  }, [setActiveFolderId, setActiveFolderName, setUploadedPhotos, setViewingOtherFolder, setStep, loadFolderPhotos]);

  const handleViewOtherFolder = useCallback((folder: ClientUploadFolder) => {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.folder_name);
    setUploadedPhotos([]);
    setViewingOtherFolder(true);
    setStep('view');
    loadFolderPhotos(folder.id);
  }, [setActiveFolderId, setActiveFolderName, setUploadedPhotos, setViewingOtherFolder, setStep, loadFolderPhotos]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch(CLIENT_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_folder',
          short_code: shortCode,
          client_id: clientId,
          folder_name: newFolderName.trim(),
          client_name: clientName.trim() || null
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create folder');
      }
      const data = await res.json();
      setActiveFolderId(data.folder_id);
      setActiveFolderName(newFolderName.trim());
      setUploadedPhotos([]);
      setStep('upload');
      const newFolder: ClientUploadFolder = {
        id: data.folder_id,
        folder_name: newFolderName.trim(),
        client_name: clientName.trim() || null,
        photo_count: 0,
        created_at: new Date().toISOString()
      };
      onFoldersUpdate([newFolder, ...existingFolders]);
      toast({ title: 'Папка создана', description: 'Теперь загрузите ваши фото' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка';
      toast({ title: 'Ошибка', description: message, variant: 'destructive' });
    }
  }, [newFolderName, clientName, shortCode, clientId, existingFolders, onFoldersUpdate, setActiveFolderId, setActiveFolderName, setUploadedPhotos, setStep, toast]);

  const handleRenameFolder = useCallback(async () => {
    if (!renameValue.trim() || !activeFolderId) return;
    setRenamingFolder(true);
    try {
      const res = await fetch(CLIENT_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename_folder',
          short_code: shortCode,
          client_id: clientId,
          upload_folder_id: activeFolderId,
          folder_name: renameValue.trim()
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка переименования');
      }
      const updatedFolders = existingFolders.map(f =>
        f.id === activeFolderId ? { ...f, folder_name: renameValue.trim() } : f
      );
      onFoldersUpdate(updatedFolders);
      setActiveFolderName(renameValue.trim());
      toast({ title: 'Папка переименована' });
      setStep('upload');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка';
      toast({ title: 'Ошибка', description: message, variant: 'destructive' });
    } finally {
      setRenamingFolder(false);
    }
  }, [renameValue, activeFolderId, shortCode, clientId, existingFolders, onFoldersUpdate, setActiveFolderName, setRenamingFolder, setStep, toast]);

  const handleDeletePhoto = useCallback(async (photoId: number) => {
    if (!window.confirm('Удалить это фото?')) return;
    try {
      setDeletingPhotoId(photoId);
      const res = await fetch(CLIENT_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'client_delete_photo',
          photo_id: photoId,
          short_code: shortCode,
          client_id: clientId,
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Ошибка удаления');
      }
      setUploadedPhotos(prev => prev.filter(p => p.photo_id !== photoId));
      const updatedFolders = existingFolders.map(f =>
        f.id === activeFolderId ? { ...f, photo_count: Math.max(0, f.photo_count - 1) } : f
      );
      onFoldersUpdate(updatedFolders);
      toast({ title: 'Фото удалено' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка';
      toast({ title: 'Ошибка', description: message, variant: 'destructive' });
    } finally {
      setDeletingPhotoId(null);
    }
  }, [shortCode, clientId, activeFolderId, existingFolders, onFoldersUpdate, setUploadedPhotos, setDeletingPhotoId, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [setIsDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, [setIsDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  }, [handleFilesSelected, setIsDragOver]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialFolderId && initialFolderName) {
      setActiveFolderId(initialFolderId);
      setActiveFolderName(initialFolderName);
      setUploadedPhotos([]);
      setViewingOtherFolder(true);
      setStep('view');
      loadFolderPhotos(initialFolderId);
      setCheckingOwnFolder(false);
      return;
    }

    setStep('folders');
    setCheckingOwnFolder(true);

    fetch(CLIENT_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list_folders',
        short_code: shortCode,
        client_id: clientId
      })
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const folders: ClientUploadFolder[] = data?.folders || [];
        onFoldersUpdate(folders);
        const ownFolder = folders.find(f => f.is_own !== false);
        if (ownFolder) {
          handleSelectFolder(ownFolder);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingOwnFolder(false));
  }, [isOpen]);

  return {
    handleCreateFolder,
    handleRenameFolder,
    handleSelectFolder,
    handleViewOtherFolder,
    handleDeletePhoto,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    loadFolderPhotos,
  };
}

export function useFileUploadHandler({
  shortCode,
  clientId,
  activeFolderId,
  activeFolderName,
  existingFolders,
  onFoldersUpdate,
  setUploading,
  setUploadProgress,
  setUploadedPhotos,
}: {
  shortCode: string;
  clientId: number;
  activeFolderId: number | null;
  activeFolderName: string;
  existingFolders: ClientUploadFolder[];
  onFoldersUpdate: (folders: ClientUploadFolder[]) => void;
  setUploading: (v: boolean) => void;
  setUploadProgress: (p: { current: number; total: number }) => void;
  setUploadedPhotos: React.Dispatch<React.SetStateAction<UploadedPhoto[]>>;
}) {
  const { toast } = useToast();

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeFolderId) return;

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const tooLargeFiles = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (tooLargeFiles.length > 0) {
      toast({
        title: 'Файлы слишком большие',
        description: `${tooLargeFiles.length} файлов превышают 50 МБ.`,
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    const uploaded: UploadedPhoto[] = [];
    const errors: string[] = [];

    const totalBytes = Array.from(files).reduce((sum, f) => sum + (f.size || 1), 0);
    let bytesDone = 0;
    const reportProgress = () => {
      const fakeCurrent = totalBytes > 0
        ? (bytesDone / totalBytes) * files.length
        : 0;
      setUploadProgress({
        current: Math.min(files.length, fakeCurrent),
        total: files.length,
      });
    };

    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      const fileSize = file.size || 1;
      try {
        if (isHeicFile(file)) {
          try {
            file = await convertHeicToJpeg(file);
          } catch (heicErr) {
            console.warn('HEIC conversion failed, uploading as-is:', heicErr);
          }
        }

        const urlRes = await fetch(CLIENT_UPLOAD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get_upload_url',
            short_code: shortCode,
            client_id: clientId,
            upload_folder_id: activeFolderId,
            file_name: file.name,
            content_type: file.type || 'image/jpeg'
          })
        });

        if (!urlRes.ok) {
          const errData = await urlRes.json();
          errors.push(`${file.name}: ${errData.error || 'ошибка'}`);
          bytesDone += fileSize;
          reportProgress();
          continue;
        }

        const { upload_url, s3_key, cdn_url } = await urlRes.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const startBytes = bytesDone;
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              bytesDone = startBytes + e.loaded;
              reportProgress();
            }
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              bytesDone = startBytes + fileSize;
              reportProgress();
              resolve();
            } else {
              reject(new Error(`PUT ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Network error')));
          xhr.addEventListener('abort', () => reject(new Error('Aborted')));
          xhr.open('PUT', upload_url);
          xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
          xhr.send(file);
        }).catch((err) => {
          throw err;
        });

        const confirmRes = await fetch(CLIENT_UPLOAD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm_upload',
            short_code: shortCode,
            client_id: clientId,
            upload_folder_id: activeFolderId,
            file_name: file.name,
            s3_key,
            cdn_url,
            content_type: file.type || 'image/jpeg',
            file_size: file.size
          })
        });

        if (confirmRes.ok) {
          const data = await confirmRes.json();
          const s3KeyLower = (s3_key || '').toLowerCase();
          if (s3KeyLower.endsWith('.heic') || s3KeyLower.endsWith('.heif')) {
            try {
              const convertRes = await fetch(HEIC_CONVERT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'convert_single', s3_key })
              });
              if (convertRes.ok) {
                const convertData = await convertRes.json();
                if (convertData.new_s3_key) {
                  const presignRes = await fetch(CLIENT_UPLOAD_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'client_list_photos',
                      short_code: shortCode,
                      client_id: clientId,
                      upload_folder_id: activeFolderId
                    })
                  });
                  if (presignRes.ok) {
                    const listData = await presignRes.json();
                    const convertedPhoto = (listData.photos || []).find(
                      (p: { file_name: string }) => p.file_name === file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
                    );
                    if (convertedPhoto) {
                      uploaded.push({ photo_id: convertedPhoto.photo_id, file_name: convertedPhoto.file_name, s3_url: convertedPhoto.s3_url });
                      reportProgress();
                      continue;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('Server HEIC conversion failed:', e);
            }
          }
          uploaded.push({ photo_id: data.photo_id ?? data.id ?? 0, file_name: data.file_name, s3_url: data.s3_url });
        } else {
          errors.push(`${file.name}: ошибка подтверждения`);
        }
      } catch (err) {
        console.error('Upload error:', err);
        errors.push(`${file.name}: ошибка сети`);
      }

      // На всякий случай — гарантируем что bytesDone выровнен по концу файла
      const expectedDone = Array.from(files).slice(0, i + 1).reduce((s, f) => s + (f.size || 1), 0);
      if (bytesDone < expectedDone) bytesDone = expectedDone;
      reportProgress();
    }

    setUploadedPhotos(prev => [...prev, ...uploaded]);
    setUploading(false);

    if (uploaded.length > 0) {
      const updatedFolders = existingFolders.map(f =>
        f.id === activeFolderId ? { ...f, photo_count: f.photo_count + uploaded.length } : f
      );
      onFoldersUpdate(updatedFolders);
      toast({ title: `${uploaded.length} фото загружено`, description: `В папку "${activeFolderName}"` });
    }

    if (errors.length > 0) {
      toast({
        title: `${errors.length} файлов не загружено`,
        description: errors[0],
        variant: 'destructive'
      });
    }
  }, [activeFolderId, shortCode, clientId, existingFolders, onFoldersUpdate, activeFolderName, toast, setUploading, setUploadProgress, setUploadedPhotos]);

  return { handleFilesSelected };
}