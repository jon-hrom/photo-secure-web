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
}

export default function ClientUploadModal({
  isOpen,
  onClose,
  shortCode,
  clientId,
  existingFolders,
  onFoldersUpdate,
  isDarkTheme = false
}: ClientUploadModalProps) {
  const [step, setStep] = useState<'folders' | 'create' | 'upload' | 'view'>('folders');
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

  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // При открытии — если есть своя папка, сразу открываем её
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (!isOpen || hasAutoOpened.current) return;
    const ownFolders = existingFolders.filter(f => f.is_own !== false);
    if (ownFolders.length > 0) {
      hasAutoOpened.current = true;
      handleSelectFolder(ownFolders[0]);
    }
  }, [isOpen, existingFolders]);

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

  const themeClasses = isDarkTheme
    ? 'bg-gray-900 text-white'
    : 'bg-white text-gray-900';

  const cardClasses = isDarkTheme
    ? 'bg-gray-800 border-gray-700'
    : 'bg-gray-50 border-gray-200';

  return (
    <>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className={`${themeClasses} rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className={`sticky top-0 z-10 px-4 sm:px-6 py-4 border-b flex items-center justify-between ${isDarkTheme ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-3">
            {step !== 'folders' && (
              <button
                onClick={() => { setStep('folders'); setUploadedPhotos([]); setViewingOtherFolder(false); }}
                className={`p-1.5 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
              >
                <Icon name="ArrowLeft" size={20} />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {step === 'folders' ? 'Загрузить фото'
                : step === 'create' ? 'Новая папка'
                : step === 'view' ? activeFolderName
                : `Загрузка в "${activeFolderName}"`}
            </h2>
          </div>
          <button onClick={() => { hasAutoOpened.current = false; onClose(); }} className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {step === 'folders' && (
            <>
              <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                Создайте папку и загрузите свои фото. Фотограф увидит вашу папку отдельно от своих фото.
              </p>

              <Button
                onClick={() => setStep('create')}
                className={`w-full h-12 border-dashed border-2 ${isDarkTheme ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : ''}`}
                variant="outline"
              >
                <Icon name="FolderPlus" size={20} className="mr-2" />
                Создать новую папку
              </Button>

              {existingFolders.length > 0 && (
                <div className="space-y-2">
                  {(() => {
                    const ownFolders = existingFolders.filter(f => f.is_own !== false);
                    const otherFolders = existingFolders.filter(f => f.is_own === false);
                    const hasGroups = otherFolders.length > 0;

                    return (
                      <>
                        {hasGroups && ownFolders.length > 0 && (
                          <p className={`text-xs font-medium uppercase tracking-wide ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                            Мои папки
                          </p>
                        )}
                        {!hasGroups && (
                          <p className={`text-xs font-medium ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                            Существующие папки
                          </p>
                        )}
                        {ownFolders.map(folder => (
                          <button
                            key={folder.id}
                            onClick={() => handleSelectFolder(folder)}
                            className={`w-full text-left p-3 rounded-lg border ${cardClasses} hover:border-blue-400 transition-colors`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Icon name="Folder" size={20} className="text-blue-500" />
                                <div>
                                  <p className="font-medium text-sm">{folder.folder_name}</p>
                                  {folder.client_name && (
                                    <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>{folder.client_name}</p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                                {folder.photo_count} фото
                              </span>
                            </div>
                          </button>
                        ))}

                        {otherFolders.length > 0 && (
                          <>
                            <p className={`text-xs font-medium uppercase tracking-wide pt-2 ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                              Фото других участников
                            </p>
                            {otherFolders.map(folder => (
                              <button
                                key={folder.id}
                                onClick={() => handleViewOtherFolder(folder)}
                                className={`w-full text-left p-3 rounded-lg border transition-colors ${isDarkTheme ? 'bg-gray-800/40 border-gray-700 hover:border-purple-500' : 'bg-gray-50 border-gray-200 hover:border-purple-400'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Icon name="FolderOpen" size={20} className={isDarkTheme ? 'text-purple-400' : 'text-purple-500'} />
                                    <div>
                                      <p className={`font-medium text-sm ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>{folder.folder_name}</p>
                                      {folder.client_name && (
                                        <p className={`text-xs ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>{folder.client_name}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {folder.photo_count} фото
                                    </span>
                                    <Icon name="ChevronRight" size={16} className={isDarkTheme ? 'text-gray-600' : 'text-gray-400'} />
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

          {step === 'create' && (
            <>
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                  Название папки *
                </label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Например: Фото от Ивановых"
                  className={`h-11 ${isDarkTheme ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500' : ''}`}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
                  Ваше имя
                </label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Как вас зовут?"
                  className={`h-11 ${isDarkTheme ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500' : ''}`}
                />
              </div>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="w-full h-11"
              >
                <Icon name="FolderPlus" size={18} className="mr-2" />
                Создать и перейти к загрузке
              </Button>
            </>
          )}

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

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  isDragOver ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300'
                }`}
              >
                <div className="space-y-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-14 text-base"
                    variant="default"
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
                  <p className={`text-xs text-center ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                    Максимальный размер одного файла: 50 МБ
                  </p>
                </div>
                <p className="text-sm text-gray-500 mt-2">или перетащите файлы сюда</p>
              </div>

              {uploading && (
                <div className={`w-full rounded-full h-2 ${isDarkTheme ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              )}

              {loadingPhotos && (
                <div className="flex items-center justify-center py-4">
                  <Icon name="Loader2" size={20} className="animate-spin text-gray-400 mr-2" />
                  <span className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Загрузка фото...</span>
                </div>
              )}

              {!loadingPhotos && uploadedPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${isDarkTheme ? 'text-green-400' : 'text-green-600'}`}>
                    Фото в папке: {uploadedPhotos.length}
                  </p>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {uploadedPhotos.map((photo) => (
                      <div key={photo.photo_id} className={`relative group aspect-square rounded-lg overflow-hidden cursor-pointer ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-100'}`}>
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

              <p className={`text-xs text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                Поддерживаются JPG, PNG, HEIC, MP4, MOV и другие форматы
              </p>

              <button
                onClick={() => setStep('create')}
                className={`w-full text-sm py-2 rounded-lg border border-dashed transition-colors ${isDarkTheme ? 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300' : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600'}`}
              >
                <Icon name="FolderPlus" size={14} className="inline mr-1.5" />
                Создать новую папку
              </button>
            </>
          )}

          {step === 'view' && (
            <>
              <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                Фото загруженные участником
              </p>

              {loadingPhotos && (
                <div className="flex items-center justify-center py-8">
                  <Icon name="Loader2" size={24} className="animate-spin text-gray-400 mr-2" />
                  <span className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Загрузка фото...</span>
                </div>
              )}

              {!loadingPhotos && uploadedPhotos.length === 0 && (
                <div className={`rounded-xl p-8 text-center ${isDarkTheme ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                  <Icon name="ImageOff" size={32} className={`mx-auto mb-2 ${isDarkTheme ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p className={`text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Фото ещё не добавлены</p>
                </div>
              )}

              {!loadingPhotos && uploadedPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    Фото в папке: {uploadedPhotos.length}
                  </p>
                  <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                    {uploadedPhotos.map((photo) => (
                      <div
                        key={photo.photo_id}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-100'}`}
                        onClick={() => setViewerPhotoId(photo.photo_id)}
                      >
                        <img src={photo.s3_url} alt={photo.file_name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
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