import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import type { UploadedPhoto } from '../PhotobookCreator';
import MyFilesTab from './MyFilesTab';
import PhotoBankTab from './PhotoBankTab';
import PhotobookUploadFooter from './PhotobookUploadFooter';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface PhotoBankPhoto {
  id: number;
  file_name: string;
  s3_url?: string;
  data_url?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotobookUploadStepProps {
  requiredPhotos: number;
  onComplete: (photos: UploadedPhoto[]) => void;
  onBack: () => void;
}

const PhotobookUploadStep = ({ requiredPhotos, onComplete, onBack }: PhotobookUploadStepProps) => {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [newUploadsCount, setNewUploadsCount] = useState(0);
  const [todayUploadsCount, setTodayUploadsCount] = useState(0);
  const [photoBankFolders, setPhotoBankFolders] = useState<PhotoFolder[]>([]);
  const [photoBankPhotos, setPhotoBankPhotos] = useState<PhotoBankPhoto[]>([]);
  const [selectedPhotoBankFolder, setSelectedPhotoBankFolder] = useState<PhotoFolder | null>(null);
  const [loadingPhotoBank, setLoadingPhotoBank] = useState(false);
  const [photoBankSelectedPhotos, setPhotoBankSelectedPhotos] = useState<Set<number>>(new Set());
  
  const unselectedCount = uploadedPhotos.length - selectedPhotos.size;
  
  const getAuthUserId = (): string | null => {
    const authSession = localStorage.getItem('authSession');
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        if (session.userId) return session.userId.toString();
      } catch {}
    }
    
    const vkUser = localStorage.getItem('vk_user');
    if (vkUser) {
      try {
        const userData = JSON.parse(vkUser);
        if (userData.user_id) return userData.user_id.toString();
        if (userData.vk_id) return userData.vk_id.toString();
      } catch {}
    }
    
    return null;
  };
  
  const userId = getAuthUserId();
  const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';

  useEffect(() => {
    const savedPhotos = localStorage.getItem('photobank_selected_photos');
    if (savedPhotos) {
      try {
        const photos = JSON.parse(savedPhotos);
        const converted = photos.map((p: any) => ({
          id: `photobank-${p.id}`,
          url: p.url,
          file: new File([], p.file_name),
          width: p.width || 0,
          height: p.height || 0
        }));
        setUploadedPhotos(converted);
        localStorage.removeItem('photobank_selected_photos');
      } catch (error) {
        console.error('Failed to load photos from photobank:', error);
      }
    }
  }, []);
  
  useEffect(() => {
    if (userId) {
      fetchPhotoBankFolders();
    }
  }, [userId]);
  
  const fetchPhotoBankFolders = async () => {
    if (!userId) return;
    
    setLoadingPhotoBank(true);
    try {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setPhotoBankFolders(data.folders || []);
    } catch (error) {
      console.error('Failed to load photobank folders:', error);
    } finally {
      setLoadingPhotoBank(false);
    }
  };
  
  const fetchPhotoBankPhotos = async (folderId: number) => {
    if (!userId) return;
    
    setLoadingPhotoBank(true);
    try {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?action=list_photos&folder_id=${folderId}`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setPhotoBankPhotos(data.photos || []);
    } catch (error) {
      console.error('Failed to load photobank photos:', error);
    } finally {
      setLoadingPhotoBank(false);
    }
  };
  
  const togglePhotoBankPhotoSelection = (photoId: number) => {
    setPhotoBankSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };
  
  const addPhotoBankPhotosToSelection = () => {
    const selected = photoBankPhotos.filter(p => photoBankSelectedPhotos.has(p.id));
    const converted = selected.map(p => ({
      id: `photobank-${p.id}`,
      url: p.s3_url || p.data_url || '',
      file: new File([], p.file_name),
      width: p.width || 0,
      height: p.height || 0
    }));
    setUploadedPhotos(prev => [...prev, ...converted]);
    setPhotoBankSelectedPhotos(new Set());
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    const newFilesCount = files.length;
    setNewUploadsCount(prev => prev + newFilesCount);
    setTodayUploadsCount(prev => prev + newFilesCount);

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const photo: UploadedPhoto = {
            id: `photo-${Date.now()}-${Math.random()}`,
            url: e.target?.result as string,
            file,
            width: img.width,
            height: img.height,
          };
          setUploadedPhotos(prev => [...prev, photo]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedPhotos(new Set(uploadedPhotos.map(p => p.id)));
  };

  const handleContinue = () => {
    const selected = uploadedPhotos.filter(p => selectedPhotos.has(p.id));
    onComplete(selected);
  };

  return (
    <div className="h-[85vh] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="ArrowLeft" size={24} />
        </Button>
        <h2 className="text-xl font-bold">Выберите фотографии</h2>
        <Button variant="ghost" size="icon" onClick={onBack}>
          <Icon name="X" size={24} />
        </Button>
      </div>

      <Tabs defaultValue="my-files" className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="my-files" className="data-[state=active]:bg-gray-100 data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none text-black">
              <Icon name="Folder" size={18} className="mr-2" />
              Мои файлы
            </TabsTrigger>
            <TabsTrigger value="photobank" className="data-[state=active]:bg-gray-100 data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none text-black">
              <Icon name="Database" size={18} className="mr-2" />
              Фотобанк
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="my-files" className="flex-1 flex flex-col m-0">
          <MyFilesTab
            uploadedPhotos={uploadedPhotos}
            selectedPhotos={selectedPhotos}
            searchQuery={searchQuery}
            view={view}
            newUploadsCount={newUploadsCount}
            todayUploadsCount={todayUploadsCount}
            unselectedCount={unselectedCount}
            onSearchQueryChange={setSearchQuery}
            onViewChange={() => setView(view === 'grid' ? 'list' : 'grid')}
            onSelectAll={selectAll}
            onFileUpload={handleFileUpload}
            onTogglePhotoSelection={togglePhotoSelection}
          />
        </TabsContent>

        <TabsContent value="photobank" className="flex-1 flex flex-col m-0">
          <PhotoBankTab
            photoBankFolders={photoBankFolders}
            photoBankPhotos={photoBankPhotos}
            selectedPhotoBankFolder={selectedPhotoBankFolder}
            loadingPhotoBank={loadingPhotoBank}
            photoBankSelectedPhotos={photoBankSelectedPhotos}
            onSelectFolder={setSelectedPhotoBankFolder}
            onFetchPhotos={fetchPhotoBankPhotos}
            onTogglePhotoSelection={togglePhotoBankPhotoSelection}
            onSelectAllPhotos={() => {
              const allIds = new Set(photoBankPhotos.map(p => p.id));
              setPhotoBankSelectedPhotos(allIds);
            }}
            onClearSelection={() => setPhotoBankSelectedPhotos(new Set())}
            onAddPhotosToSelection={addPhotoBankPhotosToSelection}
          />
        </TabsContent>
      </Tabs>

      <PhotobookUploadFooter
        selectedPhotosCount={selectedPhotos.size}
        requiredPhotos={requiredPhotos}
        onFileUpload={handleFileUpload}
        onContinue={handleContinue}
      />
    </div>
  );
};

export default PhotobookUploadStep;