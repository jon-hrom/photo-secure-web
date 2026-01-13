import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FavoriteFolder {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
}

interface FavoritesTabProps {
  folderId: number;
  userId: number;
}

export default function FavoritesTab({ folderId, userId }: FavoritesTabProps) {
  const [folder, setFolder] = useState<FavoriteFolder | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    fullName: true,
    phone: true,
    email: false
  });

  const [favorites, setFavorites] = useState<any[]>([]);
  const [groupedFavorites, setGroupedFavorites] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadFolder();
    loadFavorites();
  }, [folderId]);

  const loadFolder = async () => {
    try {
      const response = await fetch(`/api/folders/${folderId}/favorite-config`);
      if (response.ok) {
        const data = await response.json();
        setFolder(data);
        setFormData({
          name: data.name || '',
          fullName: data.fields.fullName,
          phone: data.fields.phone,
          email: data.fields.email
        });
      }
    } catch (err) {
      console.error('Failed to load folder config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const response = await fetch(`/api/folders/${folderId}/favorites`);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
        
        const grouped = data.reduce((acc: Record<string, any[]>, fav: any) => {
          const key = fav.full_name;
          if (!acc[key]) acc[key] = [];
          acc[key].push(fav);
          return acc;
        }, {});
        setGroupedFavorites(grouped);
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/folders/${folderId}/favorite-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          fields: {
            fullName: formData.fullName,
            phone: formData.phone,
            email: formData.email
          }
        })
      });
      await loadFolder();
      setIsEditing(false);
    } catch (err) {
      alert('Ошибка при сохранении настроек');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="Star" size={20} className="text-yellow-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Настройка избранного</h3>
          </div>
          {folder && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Icon name="Settings" size={16} />
              Изменить
            </Button>
          )}
        </div>

        {!folder && !isEditing ? (
          <div className="text-center py-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Избранное не настроено. Клиенты не смогут добавлять фото.
            </p>
            <Button onClick={() => setIsEditing(true)}>
              <Icon name="Plus" size={16} />
              Настроить избранное
            </Button>
          </div>
        ) : isEditing ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Название папки избранного</Label>
              <input
                id="folderName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Выпускной альбом 2024"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>

            <div>
              <Label className="mb-2 block">Обязательные поля для клиента</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fullName"
                    checked={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.checked })}
                    className="w-4 h-4 text-yellow-500 rounded"
                  />
                  <Label htmlFor="fullName" className="cursor-pointer font-normal">
                    ФИО (обязательное)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="phone"
                    checked={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.checked })}
                    className="w-4 h-4 text-yellow-500 rounded"
                  />
                  <Label htmlFor="phone" className="cursor-pointer font-normal">
                    Телефон (обязательное)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="email"
                    checked={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.checked })}
                    className="w-4 h-4 text-yellow-500 rounded"
                  />
                  <Label htmlFor="email" className="cursor-pointer font-normal">
                    Email (опциональное)
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Icon name="Check" size={16} />
                Сохранить
              </Button>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                if (folder) {
                  setFormData({
                    name: folder.name,
                    fullName: folder.fields.fullName,
                    phone: folder.fields.phone,
                    email: folder.fields.email
                  });
                }
              }}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2"><strong>Название:</strong> {folder?.name}</p>
            <p><strong>Поля:</strong> {[
              folder?.fields.fullName && 'ФИО',
              folder?.fields.phone && 'Телефон',
              folder?.fields.email && 'Email'
            ].filter(Boolean).join(', ')}</p>
          </div>
        )}
      </div>

      {folder && favorites.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="FolderHeart" size={20} className="text-yellow-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Папки избранного ({Object.keys(groupedFavorites).length})
            </h3>
          </div>

          <div className="space-y-3">
            {Object.entries(groupedFavorites).map(([name, items]) => (
              <div key={name} className="bg-white dark:bg-gray-900 rounded-lg p-3 border dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{name}</p>
                    <p className="text-sm text-gray-500">
                      {items.length} фото · {items[0].phone}
                      {items[0].email && ` · ${items[0].email}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // TODO: Открыть просмотр фото из папки
                    }}
                  >
                    <Icon name="Eye" size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
