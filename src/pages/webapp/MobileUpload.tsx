import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  s3_key?: string;
  error?: string;
}

const MobileUpload = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_URL = 'https://functions.poehali.dev/3372b3ed-5509-41e0-a542-b3774be6b702';

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      toast.error('Войдите в систему');
      navigate('/');
      return;
    }
    setUserId(storedUserId);
  }, [navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles: UploadFile[] = selectedFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    toast.success(`Выбрано ${selectedFiles.length} файлов`);
  };

  const uploadFile = async (uploadFile: UploadFile, index: number): Promise<void> => {
    const file = uploadFile.file;

    try {
      // 1. Получаем pre-signed URL
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'uploading', progress: 10 };
        return updated;
      });

      const urlResponse = await fetch(
        `${API_URL}?action=get-url&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
        {
          method: 'GET',
          headers: {
            'X-User-Id': userId!
          }
        }
      );

      if (!urlResponse.ok) {
        throw new Error('Не удалось получить URL для загрузки');
      }

      const { url, key } = await urlResponse.json();

      // 2. Загружаем файл напрямую в S3
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], progress: 30 };
        return updated;
      });

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Ошибка загрузки файла');
      }

      // 3. Подтверждаем загрузку
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], progress: 90 };
        return updated;
      });

      const confirmResponse = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId!
        },
        body: JSON.stringify({
          action: 'confirm',
          s3_key: key,
          orig_filename: file.name,
          size_bytes: file.size,
          content_type: file.type
        })
      });

      if (!confirmResponse.ok) {
        throw new Error('Не удалось подтвердить загрузку');
      }

      // Успешно загружено
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'success', progress: 100, s3_key: key };
        return updated;
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { 
          ...updated[index], 
          status: 'error', 
          progress: 0, 
          error: error.message 
        };
        return updated;
      });
    }
  };

  const handleUploadAll = async () => {
    if (files.length === 0) {
      toast.error('Выберите файлы для загрузки');
      return;
    }

    setIsUploading(true);

    // Загружаем по 3 файла одновременно
    const batchSize = 3;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map((uploadFile, batchIndex) => {
        const actualIndex = i + batchIndex;
        if (uploadFile.status === 'pending' || uploadFile.status === 'error') {
          return uploadFile(uploadFile, actualIndex);
        }
        return Promise.resolve();
      });
      
      await Promise.all(batchPromises);
    }

    setIsUploading(false);
    
    const successCount = files.filter(f => f.status === 'success').length;
    const errorCount = files.filter(f => f.status === 'error').length;

    if (errorCount === 0) {
      toast.success(`Все файлы загружены! (${successCount})`);
    } else {
      toast.warning(`Загружено ${successCount} из ${files.length} файлов`);
    }
  };

  const handleClear = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Шапка */}
        <Card className="border-purple-200/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="gap-2"
              >
                <Icon name="ArrowLeft" size={20} />
                <span className="hidden sm:inline">Назад</span>
              </Button>
              <CardTitle className="text-xl sm:text-2xl text-center flex-1">
                📸 Загрузка фото
              </CardTitle>
              <div className="w-20" />
            </div>
          </CardHeader>
        </Card>

        {/* Статистика */}
        {files.length > 0 && (
          <Card className="border-purple-200/50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{successCount}</div>
                  <div className="text-xs text-muted-foreground">Загружено</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
                  <div className="text-xs text-muted-foreground">Ожидают</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                  <div className="text-xs text-muted-foreground">Ошибки</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Кнопки управления */}
        <Card className="border-purple-200/50">
          <CardContent className="pt-6 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.raw,.cr2,.nef,.arw,.dng"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            
            <label htmlFor="file-input">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-purple-300 hover:bg-purple-50 gap-2"
                asChild
              >
                <span>
                  <Icon name="FolderOpen" size={20} />
                  Выбрать файлы
                </span>
              </Button>
            </label>

            {files.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={handleUploadAll}
                  disabled={isUploading || pendingCount === 0}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  {isUploading ? (
                    <>
                      <Icon name="Loader2" size={20} className="animate-spin mr-2" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Icon name="Upload" size={20} className="mr-2" />
                      Загрузить ({pendingCount})
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleClear}
                  variant="outline"
                  size="lg"
                  disabled={isUploading}
                >
                  <Icon name="Trash2" size={20} />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Список файлов */}
        {files.length > 0 && (
          <Card className="border-purple-200/50">
            <CardContent className="pt-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {files.map((uploadFile, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg bg-white/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {uploadFile.status === 'success' && (
                          <Icon name="CheckCircle2" size={16} className="text-green-600 flex-shrink-0" />
                        )}
                        {uploadFile.status === 'error' && (
                          <Icon name="XCircle" size={16} className="text-red-600 flex-shrink-0" />
                        )}
                        {uploadFile.status === 'uploading' && (
                          <Icon name="Loader2" size={16} className="text-blue-600 animate-spin flex-shrink-0" />
                        )}
                        {uploadFile.status === 'pending' && (
                          <Icon name="Clock" size={16} className="text-gray-400 flex-shrink-0" />
                        )}
                        <div className="truncate text-sm font-medium">
                          {uploadFile.file.name}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatFileSize(uploadFile.file.size)}
                      </div>
                      {uploadFile.error && (
                        <div className="text-xs text-red-600 mt-1">
                          {uploadFile.error}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      disabled={uploadFile.status === 'uploading'}
                      className="flex-shrink-0"
                    >
                      <Icon name="X" size={16} />
                    </Button>
                  </div>

                  {uploadFile.status === 'uploading' && (
                    <Progress value={uploadFile.progress} className="h-2" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Инструкция */}
        {files.length === 0 && (
          <Card className="border-purple-200/50">
            <CardContent className="pt-6">
              <div className="text-center space-y-4 text-muted-foreground">
                <Icon name="Camera" size={64} className="mx-auto text-purple-300" />
                <div className="space-y-2">
                  <p className="font-medium">Как загрузить фото с камеры:</p>
                  <ol className="text-sm space-y-1 text-left max-w-md mx-auto">
                    <li>1️⃣ Подключите камеру/карту к телефону</li>
                    <li>2️⃣ Нажмите "Выбрать файлы"</li>
                    <li>3️⃣ Выберите фото с карты памяти</li>
                    <li>4️⃣ Нажмите "Загрузить" для отправки</li>
                  </ol>
                  <p className="text-xs mt-4">
                    Поддерживаются RAW, JPEG, PNG и другие форматы
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileUpload;