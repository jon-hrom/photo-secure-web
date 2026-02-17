import { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const CLIENT_UPLOAD_URL = 'https://functions.poehali.dev/06dd3267-2ef6-45bc-899c-50f86e9d36e1';

interface ClientUploadFolder {
  id: number;
  folder_name: string;
  client_name: string | null;
  photo_count: number;
  created_at: string | null;
}

interface ClientUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortCode: string;
  existingFolders: ClientUploadFolder[];
  onFoldersUpdate: (folders: ClientUploadFolder[]) => void;
  isDarkTheme?: boolean;
}

export default function ClientUploadModal({
  isOpen,
  onClose,
  shortCode,
  existingFolders,
  onFoldersUpdate,
  isDarkTheme = false
}: ClientUploadModalProps) {
  const [step, setStep] = useState<'folders' | 'create' | 'upload'>('folders');
  const [newFolderName, setNewFolderName] = useState('');
  const [clientName, setClientName] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [activeFolderName, setActiveFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadedPhotos, setUploadedPhotos] = useState<{ file_name: string; s3_url: string }[]>([]);
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

  const handleSelectFolder = (folder: ClientUploadFolder) => {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.folder_name);
    setStep('upload');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeFolderId) return;

    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    const tooLargeFiles = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (tooLargeFiles.length > 0) {
      toast({ 
        title: 'Файлы слишком большие', 
        description: `${tooLargeFiles.length} файлов превышают 15 МБ. Сожмите их перед загрузкой.`,
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    const uploaded: { file_name: string; s3_url: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await fileToBase64(file);
        const res = await fetch(CLIENT_UPLOAD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload_photo',
            short_code: shortCode,
            upload_folder_id: activeFolderId,
            file_name: file.name,
            file_data: base64,
            content_type: file.type || 'image/jpeg'
          })
        });

        if (res.ok) {
          const data = await res.json();
          uploaded.push({ file_name: data.file_name, s3_url: data.s3_url });
        } else {
          const errData = await res.json();
          errors.push(`${file.name}: ${errData.error || 'ошибка'}`);
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
        description: 'Проверьте размер файлов (макс. 15 МБ)',
        variant: 'destructive'
      });
    }
  }, [activeFolderId, shortCode, existingFolders, onFoldersUpdate, activeFolderName, toast]);

  if (!isOpen) return null;

  const themeClasses = isDarkTheme
    ? 'bg-gray-900 text-white'
    : 'bg-white text-gray-900';

  const cardClasses = isDarkTheme
    ? 'bg-gray-800 border-gray-700'
    : 'bg-gray-50 border-gray-200';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className={`${themeClasses} rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="sticky top-0 z-10 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between" style={{ backgroundColor: 'inherit' }}>
          <div className="flex items-center gap-3">
            {step !== 'folders' && (
              <button
                onClick={() => { setStep(step === 'upload' ? 'folders' : 'folders'); setUploadedPhotos([]); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Icon name="ArrowLeft" size={20} />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {step === 'folders' ? 'Загрузить фото' : step === 'create' ? 'Новая папка' : `Загрузка в "${activeFolderName}"`}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
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
                className="w-full h-12 border-dashed border-2"
                variant="outline"
              >
                <Icon name="FolderPlus" size={20} className="mr-2" />
                Создать новую папку
              </Button>

              {existingFolders.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                    Существующие папки
                  </p>
                  {existingFolders.map(folder => (
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
                  className="h-11"
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
                  className="h-11"
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
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />

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
                  Максимальный размер одного файла: 15 МБ
                </p>
              </div>

              {uploading && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              )}

              {uploadedPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${isDarkTheme ? 'text-green-400' : 'text-green-600'}`}>
                    Загружено: {uploadedPhotos.length} фото
                  </p>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {uploadedPhotos.map((photo, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <img src={photo.s3_url} alt={photo.file_name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className={`text-xs text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                Поддерживаются JPG, PNG, HEIC и другие форматы изображений
              </p>
            </>
          )}
        </div>

        <div className="h-safe-bottom sm:hidden" />
      </div>
    </div>
  );
}