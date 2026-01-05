import PhotoBankDialogs from './PhotoBankDialogs';
import CameraUploadDialog from './CameraUploadDialog';
import PhotoBankUrlUploadHandler from './PhotoBankUrlUploadHandler';
import TechSortProgressDialog from './TechSortProgressDialog';
import FolderDownloadDialog from './FolderDownloadDialog';

interface PhotoFolder {
  id: number;
  folder_name: string;
  photo_count: number;
}

interface TechSortProgress {
  open: boolean;
  progress: number;
  currentFile: string;
  processedCount: number;
  totalCount: number;
  status: 'analyzing' | 'completed' | 'error';
  errorMessage: string;
}

interface DownloadProgress {
  open: boolean;
  folderName: string;
  progress: number;
  currentFile: string;
  downloadedFiles: number;
  totalFiles: number;
  status: 'preparing' | 'downloading' | 'completed' | 'error';
  errorMessage: string;
}

interface PhotoBankDialogsContainerProps {
  userId: string | null;
  folders: PhotoFolder[];
  selectedFolder: PhotoFolder | null;
  showCreateFolder: boolean;
  showClearConfirm: boolean;
  showCameraUpload: boolean;
  showUrlUpload: boolean;
  folderName: string;
  techSortProgress: TechSortProgress;
  downloadProgress: DownloadProgress;
  setShowCreateFolder: (show: boolean) => void;
  setShowClearConfirm: (show: boolean) => void;
  setShowCameraUpload: (show: boolean) => void;
  setShowUrlUpload: (show: boolean) => void;
  setFolderName: (name: string) => void;
  setSelectedFolder: (folder: PhotoFolder | null) => void;
  handleCreateFolder: () => void;
  handleClearAll: () => void;
  fetchFolders: () => Promise<any>;
  fetchPhotos: (folderId: number) => Promise<void>;
  fetchStorageUsage: () => Promise<void>;
}

const PhotoBankDialogsContainer = ({
  userId,
  folders,
  selectedFolder,
  showCreateFolder,
  showClearConfirm,
  showCameraUpload,
  showUrlUpload,
  folderName,
  techSortProgress,
  downloadProgress,
  setShowCreateFolder,
  setShowClearConfirm,
  setShowCameraUpload,
  setShowUrlUpload,
  setFolderName,
  setSelectedFolder,
  handleCreateFolder,
  handleClearAll,
  fetchFolders,
  fetchPhotos,
  fetchStorageUsage
}: PhotoBankDialogsContainerProps) => {
  return (
    <>
      <PhotoBankDialogs
        showCreateFolder={showCreateFolder}
        showClearConfirm={showClearConfirm}
        folderName={folderName}
        foldersCount={folders.length}
        onSetShowCreateFolder={setShowCreateFolder}
        onSetShowClearConfirm={setShowClearConfirm}
        onSetFolderName={setFolderName}
        onCreateFolder={handleCreateFolder}
        onClearAll={handleClearAll}
      />

      <CameraUploadDialog
        open={showCameraUpload}
        onOpenChange={setShowCameraUpload}
        userId={userId || ''}
        folders={folders}
        onUploadComplete={() => {
          fetchFolders();
          fetchStorageUsage();
        }}
      />

      <PhotoBankUrlUploadHandler
        open={showUrlUpload}
        userId={userId}
        selectedFolder={selectedFolder}
        onClose={() => setShowUrlUpload(false)}
        fetchFolders={fetchFolders}
        fetchPhotos={fetchPhotos}
        fetchStorageUsage={fetchStorageUsage}
        setSelectedFolder={setSelectedFolder}
      />

      <TechSortProgressDialog
        open={techSortProgress.open}
        progress={techSortProgress.progress}
        currentFile={techSortProgress.currentFile}
        processedCount={techSortProgress.processedCount}
        totalCount={techSortProgress.totalCount}
        status={techSortProgress.status}
        errorMessage={techSortProgress.errorMessage}
      />

      <FolderDownloadDialog
        open={downloadProgress.open}
        folderName={downloadProgress.folderName}
        progress={downloadProgress.progress}
        currentFile={downloadProgress.currentFile}
        downloadedFiles={downloadProgress.downloadedFiles}
        totalFiles={downloadProgress.totalFiles}
        status={downloadProgress.status}
        errorMessage={downloadProgress.errorMessage}
      />
    </>
  );
};

export default PhotoBankDialogsContainer;