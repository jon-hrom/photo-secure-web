import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminStorageAPI, type TrashFolder } from './AdminStorageAPI';

interface StorageTrashTabProps {
  adminKey: string;
}

export const StorageTrashTab = ({ adminKey }: StorageTrashTabProps) => {
  const [folders, setFolders] = useState<TrashFolder[]>([]);
  const [loading, setLoading] = useState(false);

  const api = useAdminStorageAPI(adminKey);

  const loadFolders = () => {
    api.fetchTrashFolders(setFolders, setLoading);
  };

  useEffect(() => {
    if (adminKey) {
      loadFolders();
    }
  }, [adminKey]);

  const totalFolders = folders.length;
  const totalSizeMB = folders.reduce((sum, f) => sum + f.total_size_mb, 0);
  const totalPhotos = folders.reduce((sum, f) => sum + f.photos_count, 0);

  const getDaysInTrash = (trashedAt: string) => {
    const now = new Date();
    const trashed = new Date(trashedAt);
    const diffMs = now.getTime() - trashed.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysUntilDeletion = (trashedAt: string) => {
    return Math.max(0, 7 - getDaysInTrash(trashedAt));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Папок в корзине</p>
              <p className="text-2xl font-bold">{totalFolders}</p>
            </div>
            <Icon name="Trash2" className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Удаляются через 7 дней
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Общий размер</p>
              <p className="text-2xl font-bold">{(totalSizeMB / 1024).toFixed(2)} GB</p>
            </div>
            <Icon name="HardDrive" className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {totalSizeMB.toFixed(0)} MB
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Фотографий</p>
              <p className="text-2xl font-bold">{totalPhotos}</p>
            </div>
            <Icon name="Image" className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Ожидают удаления
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Корзина фотобанка</h3>
          <Button onClick={loadFolders} variant="outline" size="sm" disabled={loading}>
            <Icon name={loading ? 'Loader2' : 'RefreshCw'} className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="CheckCircle" className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Корзина пуста</p>
            <p className="text-sm text-muted-foreground mt-2">
              Удалённые папки появятся здесь
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Название папки</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead className="text-right">Фото</TableHead>
                  <TableHead className="text-right">Размер</TableHead>
                  <TableHead>Удалено</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folders.map((folder) => {
                  const daysInTrash = getDaysInTrash(folder.trashed_at);
                  const daysLeft = getDaysUntilDeletion(folder.trashed_at);

                  return (
                    <TableRow key={folder.id}>
                      <TableCell className="font-mono text-xs">#{folder.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon name="Folder" className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{folder.folder_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        ID: {folder.user_id}
                      </TableCell>
                      <TableCell className="text-right">{folder.photos_count}</TableCell>
                      <TableCell className="text-right">
                        {folder.total_size_mb < 1024
                          ? `${folder.total_size_mb.toFixed(0)} MB`
                          : `${(folder.total_size_mb / 1024).toFixed(2)} GB`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(folder.trashed_at).toLocaleDateString('ru-RU')}
                        <p className="text-xs text-muted-foreground">{daysInTrash} дн. назад</p>
                      </TableCell>
                      <TableCell>
                        {daysLeft > 0 ? (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            <Icon name="Clock" className="h-3 w-3 mr-1" />
                            {daysLeft} дн. до удаления
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <Icon name="Trash2" className="h-3 w-3 mr-1" />
                            Будет удалено
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">🗑️ Автоматическая очистка корзины</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Icon name="Trash2" className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Что происходит</p>
              <p>Каждый день в 03:00 cron-задача проверяет папки, которые находятся в корзине более 7 дней</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="HardDrive" className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Удаление файлов</p>
              <p>Все фотографии удаляются из Yandex Object Storage (папка trash/...)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="Database" className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Очистка базы данных</p>
              <p>Записи удаляются из таблиц photo_bank и photo_folders</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="DollarSign" className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Экономия</p>
              <p>Освобождается место в облаке → снижаются расходы на хранение</p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>💡 Совет:</strong> Клиенты могут восстановить папки из корзины в течение 7 дней. 
            После этого данные удаляются навсегда без возможности восстановления.
          </p>
        </div>
      </Card>
    </div>
  );
};
