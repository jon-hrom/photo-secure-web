import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const STORAGE_API = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';

interface FileItem {
  objectKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  presignedUrl: string;
}

interface UsageData {
  usedGb: number;
  limitGb: number;
  percent: number;
  remainingGb: number;
  warning: boolean;
}

const MyFiles = () => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const userId = localStorage.getItem('userId') || '1';

  const fetchUsage = async () => {
    try {
      const res = await fetch(`${STORAGE_API}?action=usage`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setUsage(data);
      
      if (data.percent >= 90 && !sessionStorage.getItem('upgrade-dialog-shown')) {
        setShowUpgradeDialog(true);
        sessionStorage.setItem('upgrade-dialog-shown', 'true');
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${STORAGE_API}?action=list&limit=50&offset=0`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список файлов',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    fetchFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const presignRes = await fetch(`${STORAGE_API}?action=presign-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size
        })
      });

      const { uploadUrl, objectKey } = await presignRes.json();

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      await fetch(`${STORAGE_API}?action=confirm-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ objectKey })
      });

      toast({
        title: 'Успешно',
        description: `Файл ${file.name} загружен`
      });

      fetchUsage();
      fetchFiles();
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message || 'Не удалось загрузить файл',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (objectKey: string, filename: string) => {
    if (!confirm(`Удалить файл ${filename}?`)) return;

    try {
      await fetch(`${STORAGE_API}?action=delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ objectKey })
      });

      toast({
        title: 'Успешно',
        description: `Файл ${filename} удален`
      });

      fetchUsage();
      fetchFiles();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить файл',
        variant: 'destructive'
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="AlertCircle" size={24} className="text-orange-500" />
              Хранилище заполняется
            </DialogTitle>
            <DialogDescription>
              У вас использовано {usage?.percent.toFixed(1)}% хранилища. Рекомендуем перейти на тариф с большим объёмом, чтобы продолжить работу без ограничений.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Текущее использование:</p>
              <Progress value={usage?.percent || 0} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground">
                {usage?.usedGb.toFixed(2)} ГБ из {usage?.limitGb.toFixed(0)} ГБ
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Позже
            </Button>
            <Button onClick={() => {
              setShowUpgradeDialog(false);
              navigate('/upgrade-plan');
            }}>
              <Icon name="Zap" size={16} className="mr-2" />
              Посмотреть тарифы
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Мои файлы</h1>
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button asChild disabled={uploading}>
              <label htmlFor="file-upload" className="cursor-pointer">
                <Icon name="Upload" className="mr-2" size={18} />
                {uploading ? 'Загрузка...' : 'Загрузить файл'}
              </label>
            </Button>
          </div>
        </div>

        {usage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="HardDrive" size={20} />
                Использование хранилища
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {usage.usedGb.toFixed(2)} ГБ из {usage.limitGb.toFixed(0)} ГБ
                </span>
                <span className={usage.warning ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                  {usage.percent.toFixed(1)}%
                </span>
              </div>
              <Progress value={usage.percent} className="h-3" />
              {usage.warning && (
                <Alert variant="destructive">
                  <Icon name="AlertTriangle" size={16} />
                  <AlertDescription>
                    Осталось {usage.remainingGb.toFixed(2)} ГБ. Рекомендуем увеличить тариф.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Файлы ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" className="animate-spin text-muted-foreground" size={32} />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="FolderOpen" className="mx-auto mb-3" size={48} />
                <p>Файлов пока нет</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.objectKey}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {file.mimeType.startsWith('image/') ? (
                      <img
                        src={file.presignedUrl}
                        alt={file.filename}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                        <Icon name="File" size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a href={file.presignedUrl} target="_blank" rel="noopener noreferrer">
                          <Icon name="Download" size={18} />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(file.objectKey, file.filename)}
                      >
                        <Icon name="Trash2" size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyFiles;