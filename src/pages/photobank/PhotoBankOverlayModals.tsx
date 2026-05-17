import { PhotoBankModals } from '@/pages/photobank/PhotoBankModals';
import ViewsStatsModal from '@/components/photobank/ViewsStatsModal';

interface PhotoBankOverlayModalsProps {
  shareModalFolder: { id: number; name: string } | null;
  showFavorites: boolean;
  selectedFolder: { id: number; folder_name?: string } | null;
  showStats: boolean;
  showVideoUrlUpload: boolean;
  chatClient: { id: number; name: string } | null;
  folderChatsId: number | null;
  userId: string;
  setShareModalFolder: (v: { id: number; name: string } | null) => void;
  setShowFavorites: (v: boolean) => void;
  setShowStats: (v: boolean) => void;
  setShowVideoUrlUpload: (v: boolean) => void;
  setChatClient: (v: { id: number; name: string } | null) => void;
  setFolderChatsId: (v: number | null) => void;
  fetchPhotos: (folderId: number) => void;
  fetchFolders: () => void;
  fetchStorageUsage: () => void;
  viewsStatsFolder: { id: number; name: string } | null;
  setViewsStatsFolder: (v: { id: number; name: string } | null) => void;
}

const PhotoBankOverlayModals = ({
  shareModalFolder,
  showFavorites,
  selectedFolder,
  showStats,
  showVideoUrlUpload,
  chatClient,
  folderChatsId,
  userId,
  setShareModalFolder,
  setShowFavorites,
  setShowStats,
  setShowVideoUrlUpload,
  setChatClient,
  setFolderChatsId,
  fetchPhotos,
  fetchFolders,
  fetchStorageUsage,
  viewsStatsFolder,
  setViewsStatsFolder,
}: PhotoBankOverlayModalsProps) => {
  return (
    <>
      <PhotoBankModals
        shareModalFolder={shareModalFolder}
        showFavorites={showFavorites}
        selectedFolder={selectedFolder}
        showStats={showStats}
        showVideoUrlUpload={showVideoUrlUpload}
        chatClient={chatClient}
        folderChatsId={folderChatsId}
        userId={userId}
        onCloseShareModal={() => setShareModalFolder(null)}
        onCloseFavorites={() => setShowFavorites(false)}
        onCloseStats={() => setShowStats(false)}
        onCloseVideoUrlUpload={() => setShowVideoUrlUpload(false)}
        onCloseChat={() => setChatClient(null)}
        onCloseFolderChats={() => {
          setFolderChatsId(null);
          fetchFolders();
        }}
        onVideoUploadSuccess={() => {
          if (selectedFolder) {
            fetchPhotos(selectedFolder.id);
          }
          fetchFolders();
          fetchStorageUsage();
        }}
      />

      {viewsStatsFolder && userId && (
        <ViewsStatsModal
          isOpen={!!viewsStatsFolder}
          onClose={() => setViewsStatsFolder(null)}
          folderId={viewsStatsFolder.id}
          folderName={viewsStatsFolder.name}
          userId={parseInt(userId)}
        />
      )}
    </>
  );
};

export default PhotoBankOverlayModals;
