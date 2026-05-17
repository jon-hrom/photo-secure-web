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

interface Favorite {
  fullName: string;
  phone: string;
  email?: string;
  photoId: number;
  photo: {
    file_name: string;
    photo_url: string;
    thumbnail_url?: string;
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
    fullName: true,
    phone: true,
    email: false
  });

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [groupedFavorites, setGroupedFavorites] = useState<Record<string, Favorite[]>>({});

  useEffect(() => {
    const loadData = async () => {
      // Загружаем данные с сервера (source of truth)
      const galleryCode = localStorage.getItem(`folder_${folderId}_gallery_code`);
      
      if (galleryCode) {
        try {
          const response = await fetch(
            `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${galleryCode}`,
            { headers: { 'X-User-Id': userId.toString() } }
          );
          if (response.ok) {
            const data = await response.json();
            console.log('[FAVORITES_TAB] Данные загружены с сервера:', data);
            
            // Обновляем favorite_config из БД
            if (data.favorite_config) {
              setFolder(data.favorite_config);
              setFormData({
                fullName: data.favorite_config.fields.fullName,
                phone: data.favorite_config.fields.phone,
                email: data.favorite_config.fields.email
              });
              
              // Кэшируем в localStorage
              localStorage.setItem(`folder_${folderId}_favorite_config`, JSON.stringify(data.favorite_config));
              console.log('[FAVORITES_TAB] favorite_config загружен из БД');
            }
          }
        } catch (err) {
          console.error('[FAVORITES_TAB] Ошибка загрузки с сервера:', err);
          
          // Fallback на localStorage
          const savedFolder = localStorage.getItem(`folder_${folderId}_favorite_config`);
          if (savedFolder) {
            try {
              const data = JSON.parse(savedFolder);
              setFolder(data);
              setFormData({
                fullName: data.fields.fullName,
                phone: data.fields.phone,
                email: data.fields.email
              });
            } catch (e) {
              console.error('Failed to parse folder config:', e);
            }
          }
        }
        
        // Загружаем избранное (если есть)
        const savedFavorites = localStorage.getItem(`favorites_${galleryCode}`);
        if (savedFavorites) {
          try {
            const data = JSON.parse(savedFavorites);
            setFavorites(data);
            
            const grouped = data.reduce((acc: Record<string, Favorite[]>, fav: Favorite) => {
              const key = fav.fullName;
              if (!acc[key]) acc[key] = [];
              acc[key].push(fav);
              return acc;
            }, {});
            setGroupedFavorites(grouped);
          } catch (e) {
            console.error('Failed to parse favorites:', e);
          }
        }
      }
      
      setLoading(false);
    };
    
    loadData();
  }, [folderId]);

  const handleSave = async () => {
    const newFolder = {
      id: folderId.toString(),
      name: 'Избранное',
      fields: {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email
      }
    };
    
    localStorage.setItem(`folder_${folderId}_favorite_config`, JSON.stringify(newFolder));
    setFolder(newFolder);
    setIsEditing(false);
    
    try {
      const response = await fetch('https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          action: 'update_favorite_config',
          folder_id: folderId,
          user_id: userId,
          favorite_config: newFolder
        })
      });
      if (response.ok) {
        console.log('[FAVORITES_TAB] Настройки сохранены в БД');
      } else {
        console.error('[FAVORITES_TAB] Ошибка сохранения в БД');
      }
    } catch (err) {
      console.error('[FAVORITES_TAB] Ошибка отправки на сервер:', err);
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
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                💡 Клиенты будут создавать свои папки избранного по ФИО при добавлении фото
              </p>
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
            <p><strong>Поля для клиентов:</strong> {[
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
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{name}</p>
                    <p className="text-sm text-gray-500">
                      {items.length} фото · {items[0].phone}
                      {items[0].email && ` · ${items[0].email}`}
                    </p>
                    <div className="grid grid-cols-4 gap-1 mt-2">
                      {items.slice(0, 4).map((item: Favorite, idx: number) => (
                        <img
                          key={idx}
                          src={item.photo.thumbnail_url || item.photo.photo_url}
                          alt={item.photo.file_name}
                          className="w-full h-16 object-cover rounded"
                        />
                      ))}
                      {items.length > 4 && (
                        <div className="w-full h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400">
                          +{items.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}