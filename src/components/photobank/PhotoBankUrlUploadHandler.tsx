import UrlUploadDialog from './UrlUploadDialog';

interface PhotoFolder {
  id: number;
  folder_name: string;
}

interface PhotoBankUrlUploadHandlerProps {
  open: boolean;
  userId: string | null;
  selectedFolder: PhotoFolder | null;
  onClose: () => void;
  fetchFolders: () => Promise<any>;
  fetchPhotos: (folderId: number) => Promise<void>;
  fetchStorageUsage: () => Promise<void>;
  setSelectedFolder: (folder: PhotoFolder | null) => void;
}

const PhotoBankUrlUploadHandler = ({
  open,
  userId,
  selectedFolder,
  onClose,
  fetchFolders,
  fetchPhotos,
  fetchStorageUsage,
  setSelectedFolder
}: PhotoBankUrlUploadHandlerProps) => {
  const handleUpload = async (url: string, folderId?: number, signal?: AbortSignal) => {
    if (!userId) throw new Error('Требуется авторизация');

    const response = await fetch('https://functions.poehali.dev/f0385237-b64f-49d6-8491-e534ca5056f7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify({
        url,
        folder_id: folderId || selectedFolder?.id || null
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка загрузки');
    }

    const result = await response.json();

    await fetchFolders();
    await fetchStorageUsage();
    
    if (result.folder_id) {
      await fetchPhotos(result.folder_id);
      const updatedFolders = await fetchFolders();
      const newFolder = updatedFolders?.find((f: PhotoFolder) => f.id === result.folder_id);
      if (newFolder) {
        setSelectedFolder(newFolder);
      }
    } else if (selectedFolder) {
      await fetchPhotos(selectedFolder.id);
    }

    return result;
  };

  return (
    <UrlUploadDialog
      open={open}
      onClose={onClose}
      onUpload={handleUpload}
    />
  );
};

export default PhotoBankUrlUploadHandler;