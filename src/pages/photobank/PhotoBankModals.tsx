import ShareFolderModal from '@/components/photobank/ShareFolderModal';
import FavoritesViewModal from '@/components/photobank/FavoritesViewModal';
import DownloadStats from '@/components/photobank/DownloadStats';
import ChatModal from '@/components/gallery/ChatModal';
import PhotographerChatsModal from '@/components/photobank/PhotographerChatsModal';
import VideoUrlUploadDialog from '@/components/photobank/VideoUrlUploadDialog';
import Icon from '@/components/ui/icon';

interface PhotoBankModalsProps {
  shareModalFolder: { id: number; name: string } | null;
  showFavorites: boolean;
  selectedFolder: { id: number; folder_name: string } | null;
  showStats: boolean;
  showVideoUrlUpload: boolean;
  chatClient: { id: number; name: string } | null;
  folderChatsId: number | null;
  userId: string;
  onCloseShareModal: () => void;
  onCloseFavorites: () => void;
  onCloseStats: () => void;
  onCloseVideoUrlUpload: () => void;
  onCloseChat: () => void;
  onCloseFolderChats: () => void;
  onVideoUploadSuccess?: () => void;
}

export const PhotoBankModals = ({
  shareModalFolder,
  showFavorites,
  selectedFolder,
  showStats,
  showVideoUrlUpload,
  chatClient,
  folderChatsId,
  userId,
  onCloseShareModal,
  onCloseFavorites,
  onCloseStats,
  onCloseVideoUrlUpload,
  onCloseChat,
  onCloseFolderChats,
  onVideoUploadSuccess,
}: PhotoBankModalsProps) => {
  return (
    <>
      {shareModalFolder && (
        <ShareFolderModal
          folderId={shareModalFolder.id}
          folderName={shareModalFolder.name}
          userId={userId}
          onClose={onCloseShareModal}
        />
      )}

      {showFavorites && selectedFolder && (
        <FavoritesViewModal
          folderId={selectedFolder.id}
          folderName={selectedFolder.folder_name}
          userId={userId}
          onClose={onCloseFavorites}
        />
      )}

      {showStats && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-2xl font-bold">Статистика скачиваний</h2>
              <button
                onClick={onCloseStats}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Icon name="X" size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <DownloadStats userId={parseInt(userId)} />
            </div>
          </div>
        </div>
      )}

      {chatClient && (
        <ChatModal
          isOpen={true}
          onClose={onCloseChat}
          clientId={chatClient.id}
          photographerId={parseInt(userId)}
          senderType="photographer"
          clientName={chatClient.name}
        />
      )}

      {folderChatsId !== null && (
        <PhotographerChatsModal
          isOpen={true}
          onClose={onCloseFolderChats}
          photographerId={parseInt(userId)}
        />
      )}

      <VideoUrlUploadDialog
        open={showVideoUrlUpload}
        onOpenChange={(open) => !open && onCloseVideoUrlUpload()}
        userId={userId}
        folderId={selectedFolder?.id || null}
        onSuccess={onVideoUploadSuccess}
      />
    </>
  );
};