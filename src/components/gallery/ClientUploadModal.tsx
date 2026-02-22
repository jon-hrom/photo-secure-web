import { useState, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import GalleryPhotoViewer from '@/components/gallery/GalleryPhotoViewer';
import ClientUploadStepFolders from '@/components/gallery/ClientUploadStepFolders';
import { ClientUploadStepCreate, ClientUploadStepRename } from '@/components/gallery/ClientUploadStepCreate';
import ClientUploadStepUpload from '@/components/gallery/ClientUploadStepUpload';
import ClientUploadStepView from '@/components/gallery/ClientUploadStepView';

const CLIENT_UPLOAD_URL = 'https://functions.poehali.dev/06dd3267-2ef6-45bc-899c-50f86e9d36e1';

interface ClientUploadFolder {
  id: number;
  folder_name: string;
  client_name: string | null;
  photo_count: number;
  created_at: string | null;
  is_own?: boolean;
}

interface ClientUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortCode: string;
  clientId: number;
  existingFolders: ClientUploadFolder[];
  onFoldersUpdate: (folders: ClientUploadFolder[]) => void;
  isDarkTheme?: boolean;
  initialFolderId?: number;
  initialFolderName?: string;
}

export default function ClientUploadModal({
  isOpen,
  onClose,
  shortCode,
  clientId,
  existingFolders,
  onFoldersUpdate,
  isDarkTheme = false,
  initialFolderId,
  initialFolderName
}: ClientUploadModalProps) {
  const [step, setStep] = useState<'folders' | 'create' | 'upload' | 'view' | 'rename'>('folders');
  const [viewingOtherFolder, setViewingOtherFolder] = useState(false);
  const [viewerPhotoId, setViewerPhotoId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [clientName, setClientName] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [activeFolderName, setActiveFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadedPhotos, setUploadedPhotos] = useState<{ photo_id: number; file_name: string; s3_url: string }[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [checkingOwnFolder, setCheckingOwnFolder] = useState(false);
  const { toast } = useToast();

  const handleCreateFolder = async () => {
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
  };

  const handleRenameFolder = async () => {
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
  };

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
  }, [shortCode, clientId]);

  const handleSelectFolder = (folder: ClientUploadFolder) => {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.folder_name);
    setUploadedPhotos([]);
    setViewingOtherFolder(false);
    setStep('upload');
    loadFolderPhotos(folder.id);
  };

  const handleViewOtherFolder = (folder: ClientUploadFolder) => {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.folder_name);
    setUploadedPhotos([]);
    setViewingOtherFolder(true);
    setStep('view');
    loadFolderPhotos(folder.id);
  };

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
    const uploaded: { photo_id: number; file_name: string; s3_url: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
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
          setUploadProgress({ current: i + 1, total: files.length });
          continue;
        }

        const { upload_url, s3_key, cdn_url } = await urlRes.json();

        const putRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file
        });

        if (!putRes.ok) {
          errors.push(`${file.name}: ошибка загрузки в хранилище`);
          setUploadProgress({ current: i + 1, total: files.length });
          continue;
        }

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
          uploaded.push({ photo_id: data.photo_id ?? data.id ?? 0, file_name: data.file_name, s3_url: data.s3_url });
        } else {
          errors.push(`${file.name}: ошибка подтверждения`);
        }
      } catch (err) {
        console.error('Upload error:', err);
        errors.push(`${file.name}: ошибка сети`);
      }

      setUploadProgress({ current: i + 1, total: files.length });
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
  }, [activeFolderId, shortCode, clientId, existingFolders, onFoldersUpdate, activeFolderName, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  }, [handleFilesSelected]);

  const handleDeletePhoto = async (photoId: number) => {
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
  };

  if (!isOpen) return null;

  const viewerPhotos = uploadedPhotos.map(p => ({
    id: p.photo_id,
    file_name: p.file_name,
    photo_url: p.s3_url,
    file_size: 0
  }));

  const bg = 'bg-[#1a1a2e]';
  const headerBg = 'bg-[#1a1a2e] border-white/10';
  const text = 'text-white';
  const subText = 'text-gray-400';
  const cardBg = 'bg-white/8 border-white/10';
  const inputCls = 'bg-white/10 border-white/15 text-white placeholder:text-gray-500 focus:border-blue-400';
  const hoverCard = 'hover:border-blue-400/60 hover:bg-white/12';
  const hoverBtn = 'hover:bg-white/10';

  const getStepTitle = () => {
    if (step === 'folders') return 'Загрузить фото';
    if (step === 'create') return 'Новая папка';
    if (step === 'rename') return 'Переименовать папку';
    if (step === 'view') return activeFolderName;
    return `"${activeFolderName}"`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
        <div className={`${bg} ${text} rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-white/10`}>
          {/* Header */}
          <div className={`sticky top-0 z-10 px-4 sm:px-6 py-4 border-b ${headerBg} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {step !== 'folders' && (
                <button
                  onClick={() => {
                    if (step === 'rename') {
                      setStep('upload');
                    } else {
                      setStep('folders');
                      setUploadedPhotos([]);
                      setViewingOtherFolder(false);
                    }
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${hoverBtn}`}
                >
                  <Icon name="ArrowLeft" size={20} />
                </button>
              )}
              <h2 className="text-lg font-semibold">{getStepTitle()}</h2>
            </div>
            <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${hoverBtn}`}>
              <Icon name="X" size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {checkingOwnFolder && (
              <div className="flex items-center justify-center py-16">
                <Icon name="Loader2" size={28} className="animate-spin text-gray-500" />
              </div>
            )}

            {!checkingOwnFolder && step === 'folders' && (
              <ClientUploadStepFolders
                existingFolders={existingFolders}
                subText={subText}
                cardBg={cardBg}
                hoverCard={hoverCard}
                onSelectFolder={handleSelectFolder}
                onViewOtherFolder={handleViewOtherFolder}
                onCreateFolder={() => setStep('create')}
              />
            )}

            {step === 'create' && (
              <ClientUploadStepCreate
                newFolderName={newFolderName}
                clientName={clientName}
                inputCls={inputCls}
                subText={subText}
                onChangeFolderName={setNewFolderName}
                onChangeClientName={setClientName}
                onSubmit={handleCreateFolder}
              />
            )}

            {step === 'rename' && (
              <ClientUploadStepRename
                renameValue={renameValue}
                renamingFolder={renamingFolder}
                inputCls={inputCls}
                subText={subText}
                onChangeRenameValue={setRenameValue}
                onSubmit={handleRenameFolder}
              />
            )}

            {step === 'upload' && (
              <ClientUploadStepUpload
                uploading={uploading}
                uploadProgress={uploadProgress}
                uploadedPhotos={uploadedPhotos}
                loadingPhotos={loadingPhotos}
                deletingPhotoId={deletingPhotoId}
                isDragOver={isDragOver}
                activeFolderName={activeFolderName}
                subText={subText}
                onFilesSelected={handleFilesSelected}
                onDeletePhoto={handleDeletePhoto}
                onViewPhoto={setViewerPhotoId}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onRenameClick={() => { setRenameValue(activeFolderName); setStep('rename'); }}
                onCreateFolder={() => setStep('create')}
              />
            )}

            {step === 'view' && (
              <ClientUploadStepView
                uploadedPhotos={uploadedPhotos}
                loadingPhotos={loadingPhotos}
                subText={subText}
                onViewPhoto={setViewerPhotoId}
              />
            )}
          </div>

          <div className="h-safe-bottom sm:hidden" />
        </div>
      </div>

      {viewerPhotoId !== null && viewerPhotos.length > 0 && (
        <GalleryPhotoViewer
          photos={viewerPhotos}
          initialPhotoId={viewerPhotoId}
          onClose={() => setViewerPhotoId(null)}
          downloadDisabled={false}
        />
      )}
    </>
  );
}
