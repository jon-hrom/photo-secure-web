import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import GalleryPhotoViewer from '@/components/gallery/GalleryPhotoViewer';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [checkingOwnFolder, setCheckingOwnFolder] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Если открыли через клик по папке другого участника — сразу в режим просмотра
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

  // Всегда тёмная тема для клиентской модалки
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
          {/* Loading state */}
          {checkingOwnFolder && (
            <div className="flex items-center justify-center py-16">
              <Icon name="Loader2" size={28} className="animate-spin text-gray-500" />
            </div>
          )}

          {/* STEP: folders */}
          {!checkingOwnFolder && step === 'folders' && (
            <>
              <p className={`text-sm ${subText}`}>
                Создайте папку и загрузите свои фото. Фотограф увидит вашу папку отдельно от своих фото.
              </p>

              <button
                onClick={() => setStep('create')}
                className="w-full h-12 border border-dashed border-white/20 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-300 hover:border-blue-400/60 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
              >
                <Icon name="FolderPlus" size={18} />
                Создать новую папку
              </button>

              {existingFolders.length > 0 && (
                <div className="space-y-2">
                  {(() => {
                    const ownFolders = existingFolders.filter(f => f.is_own !== false);
                    const otherFolders = existingFolders.filter(f => f.is_own === false);
                    const hasGroups = otherFolders.length > 0;

                    return (
                      <>
                        {hasGroups && ownFolders.length > 0 && (
                          <p className={`text-xs font-medium uppercase tracking-wide ${subText}`}>
                            Мои папки
                          </p>
                        )}
                        {!hasGroups && ownFolders.length > 0 && (
                          <p className={`text-xs font-medium ${subText}`}>
                            Мои папки
                          </p>
                        )}
                        {ownFolders.map(folder => (
                          <button
                            key={folder.id}
                            onClick={() => handleSelectFolder(folder)}
                            className={`w-full text-left p-3 rounded-xl border ${cardBg} ${hoverCard} transition-all`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Icon name="Folder" size={20} className="text-blue-400" />
                                <div>
                                  <p className="font-medium text-sm text-white">{folder.folder_name}</p>
                                  {folder.client_name && (
                                    <p className={`text-xs ${subText}`}>{folder.client_name}</p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-xs ${subText}`}>{folder.photo_count} фото</span>
                            </div>
                          </button>
                        ))}

                        {otherFolders.length > 0 && (
                          <>
                            <p className={`text-xs font-medium uppercase tracking-wide pt-2 ${subText}`}>
                              Фото других участников
                            </p>
                            {otherFolders.map(folder => (
                              <button
                                key={folder.id}
                                onClick={() => handleViewOtherFolder(folder)}
                                className="w-full text-left p-3 rounded-xl border border-white/8 bg-white/4 hover:border-purple-400/50 hover:bg-purple-500/10 transition-all"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Icon name="FolderOpen" size={20} className="text-purple-400" />
                                    <div>
                                      <p className="font-medium text-sm text-gray-200">{folder.folder_name}</p>
                                      {folder.client_name && (
                                        <p className="text-xs text-gray-500">{folder.client_name}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">{folder.photo_count} фото</span>
                                    <Icon name="ChevronRight" size={16} className="text-gray-600" />
                                  </div>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* STEP: create */}
          {step === 'create' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Название папки *</label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Например: Фото от Ивановых"
                  className={`h-11 ${inputCls}`}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Ваше имя</label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Как вас зовут?"
                  className={`h-11 ${inputCls}`}
                />
              </div>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Icon name="FolderPlus" size={18} className="mr-2" />
                Создать и перейти к загрузке
              </Button>
            </>
          )}

          {/* STEP: rename */}
          {step === 'rename' && (
            <>
              <p className={`text-sm ${subText}`}>Введите новое название папки</p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Новое название *</label>
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Название папки"
                  className={`h-11 ${inputCls}`}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
                />
              </div>
              <Button
                onClick={handleRenameFolder}
                disabled={!renameValue.trim() || renamingFolder}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {renamingFolder ? (
                  <><Icon name="Loader2" size={18} className="mr-2 animate-spin" />Сохранение...</>
                ) : (
                  <><Icon name="Pencil" size={18} className="mr-2" />Сохранить название</>
                )}
              </Button>
            </>
          )}

          {/* STEP: upload */}
          {step === 'upload' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />

              {/* Rename button */}
              <button
                onClick={() => { setRenameValue(activeFolderName); setStep('rename'); }}
                className={`flex items-center gap-1.5 text-xs ${subText} hover:text-gray-200 transition-colors`}
              >
                <Icon name="Pencil" size={12} />
                Переименовать папку
              </button>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  isDragOver ? 'border-blue-400 bg-blue-500/10' : 'border-white/15'
                }`}
              >
                <div className="space-y-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-14 text-base bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {uploading ? (
                      <>
                        <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                        Загрузка {uploadProgress.current}/{uploadProgress.total}...
                      </>
                    ) : (
                      <>
                        <Icon name="ImagePlus" size={20} className="mr-2" />
                        Выбрать фото
                      </>
                    )}
                  </Button>
                  <p className={`text-xs text-center ${subText}`}>
                    Максимальный размер одного файла: 50 МБ
                  </p>
                </div>
                <p className="text-sm text-gray-600 mt-2">или перетащите файлы сюда</p>
              </div>

              {uploading && (
                <div className="w-full rounded-full h-1.5 bg-white/10">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              )}

              {loadingPhotos && (
                <div className="flex items-center justify-center py-4">
                  <Icon name="Loader2" size={20} className="animate-spin text-gray-500 mr-2" />
                  <span className={`text-sm ${subText}`}>Загрузка фото...</span>
                </div>
              )}

              {!loadingPhotos && uploadedPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-green-400">
                    Фото в папке: {uploadedPhotos.length}
                  </p>
                  <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
                    {uploadedPhotos.map((photo) => (
                      <div key={photo.photo_id} className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer bg-white/8">
                        <img
                          src={photo.s3_url}
                          alt={photo.file_name}
                          className="w-full h-full object-cover"
                          onClick={() => setViewerPhotoId(photo.photo_id)}
                        />
                        <button
                          onClick={() => handleDeletePhoto(photo.photo_id)}
                          disabled={deletingPhotoId === photo.photo_id}
                          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {deletingPhotoId === photo.photo_id ? (
                            <Icon name="Loader2" size={12} className="animate-spin" />
                          ) : (
                            <Icon name="X" size={12} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className={`text-xs text-center ${subText}`}>
                Поддерживаются JPG, PNG, HEIC, MP4, MOV и другие форматы
              </p>

              <button
                onClick={() => setStep('create')}
                className="w-full text-sm py-2 rounded-lg border border-dashed border-white/12 text-gray-600 hover:border-white/25 hover:text-gray-400 transition-all"
              >
                <Icon name="FolderPlus" size={14} className="inline mr-1.5" />
                Создать новую папку
              </button>
            </>
          )}

          {/* STEP: view (other's folder) */}
          {step === 'view' && (
            <>
              <p className={`text-sm ${subText}`}>
                Фото загруженные участником
              </p>

              {loadingPhotos && (
                <div className="flex items-center justify-center py-8">
                  <Icon name="Loader2" size={24} className="animate-spin text-gray-500 mr-2" />
                  <span className={`text-sm ${subText}`}>Загрузка фото...</span>
                </div>
              )}

              {!loadingPhotos && uploadedPhotos.length === 0 && (
                <div className="rounded-xl p-8 text-center bg-white/5">
                  <Icon name="ImageOff" size={32} className="mx-auto mb-2 text-gray-600" />
                  <p className={`text-sm ${subText}`}>Фото ещё не добавлены</p>
                </div>
              )}

              {!loadingPhotos && uploadedPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${subText}`}>
                    Фото в папке: {uploadedPhotos.length}
                  </p>
                  <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                    {uploadedPhotos.map((photo) => (
                      <div
                        key={photo.photo_id}
                        className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer bg-white/8"
                        onClick={() => setViewerPhotoId(photo.photo_id)}
                      >
                        <img src={photo.s3_url} alt={photo.file_name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const a = document.createElement('a');
                            a.href = photo.s3_url;
                            a.download = photo.file_name;
                            a.target = '_blank';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="absolute bottom-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Скачать"
                        >
                          <Icon name="Download" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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