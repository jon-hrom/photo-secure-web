import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FavoriteFolder {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
  photoCount: number;
}

interface FavoriteFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FavoriteFolder[];
  onCreateFolder: (name: string, fields: { fullName: boolean; phone: boolean; email: boolean }) => void;
  onDeleteFolder: (id: string) => void;
  onOpenFolder: (folder: FavoriteFolder) => void;
}

export default function FavoriteFoldersModal({
  isOpen,
  onClose,
  folders,
  onCreateFolder,
  onDeleteFolder,
  onOpenFolder
}: FavoriteFoldersModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderFields, setNewFolderFields] = useState({
    fullName: true,
    phone: true,
    email: false
  });

  if (!isOpen) return null;

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName, newFolderFields);
      setNewFolderName('');
      setNewFolderFields({ fullName: true, phone: true, email: false });
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Icon name="FolderHeart" size={24} className="text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">Папки избранного</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isCreating ? (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-4">Создать новую папку</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="folderName">Название папки</Label>
                  <Input
                    id="folderName"
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Свадьба, День рождения..."
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Обязательные поля для клиента</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fullName"
                        checked={newFolderFields.fullName}
                        onChange={(e) => setNewFolderFields({ ...newFolderFields, fullName: e.target.checked })}
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
                        checked={newFolderFields.phone}
                        onChange={(e) => setNewFolderFields({ ...newFolderFields, phone: e.target.checked })}
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
                        checked={newFolderFields.email}
                        onChange={(e) => setNewFolderFields({ ...newFolderFields, email: e.target.checked })}
                        className="w-4 h-4 text-yellow-500 rounded"
                      />
                      <Label htmlFor="email" className="cursor-pointer font-normal">
                        Email (опциональное)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreateFolder} className="bg-yellow-500 hover:bg-yellow-600">
                    <Icon name="Plus" size={16} />
                    Создать
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsCreating(false);
                    setNewFolderName('');
                    setNewFolderFields({ fullName: true, phone: true, email: false });
                  }}>
                    Отмена
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={() => setIsCreating(true)} className="mb-4 bg-yellow-500 hover:bg-yellow-600">
              <Icon name="Plus" size={16} />
              Создать папку
            </Button>
          )}

          <div className="space-y-3">
            {folders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Icon name="FolderOpen" size={48} className="mx-auto mb-3 opacity-50" />
                <p>Пока нет папок избранного</p>
              </div>
            ) : (
              folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => onOpenFolder(folder)}
                  >
                    <Icon name="Folder" size={24} className="text-yellow-500" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{folder.name}</h3>
                      <p className="text-sm text-gray-500">
                        {folder.photoCount} фото · Поля: {[
                          folder.fields.fullName && 'ФИО',
                          folder.fields.phone && 'Телефон',
                          folder.fields.email && 'Email'
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteFolder(folder.id)}
                    className="p-2 hover:bg-red-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Icon name="Trash2" size={18} className="text-red-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
