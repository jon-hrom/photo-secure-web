import { useState } from 'react';
import MaxMessageModal from './share/MaxMessageModal';
import FavoritesTab from './share/FavoritesTab';
import PageDesignTab from './share/PageDesignTab';
import ShareModalHeader from './share/ShareModalHeader';
import ShareLinkTab from './share/ShareLinkTab';
import useShareModalData from './share/useShareModalData';

interface ShareFolderModalProps {
  folderId: number;
  folderName: string;
  userId: number;
  onClose: () => void;
}

export default function ShareFolderModal({ folderId, folderName, userId, onClose }: ShareFolderModalProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'link' | 'favorites'>('design');

  const {
    loading,
    shareUrl,
    selectedClient,
    clients,
    showMaxModal,
    setShowMaxModal,
    galleryPhotos,
    pageDesign,
    setPageDesign,
    linkSettings,
    setLinkSettings,
    error,
    generateShareLink,
    handleSendViaMax,
    getExpiryText,
    handleCopyLink,
    handleClientChange,
  } = useShareModalData(folderId, folderName, userId);

  const onSendViaMax = async (message: string) => {
    const success = await handleSendViaMax(message);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div 
        className={`bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl transition-all ${
          activeTab === 'design' ? 'max-w-4xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <ShareModalHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={onClose}
        />

        <div className="p-4 sm:p-6 space-y-4">
          {activeTab === 'design' ? (
            <PageDesignTab
              folderId={folderId}
              folderName={folderName}
              userId={userId}
              photos={galleryPhotos}
              settings={pageDesign}
              onSettingsChange={setPageDesign}
            />
          ) : activeTab === 'link' ? (
            <ShareLinkTab
              clients={clients}
              selectedClient={selectedClient}
              onClientChange={handleClientChange}
              shareUrl={shareUrl}
              onCopyLink={handleCopyLink}
              onSendViaMax={() => setShowMaxModal(true)}
              linkSettings={linkSettings}
              setLinkSettings={setLinkSettings}
              loading={loading}
              error={error}
              onGenerateLink={generateShareLink}
              folderName={folderName}
            />
          ) : (
            <>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Папка</p>
                <p className="font-medium text-gray-900 dark:text-white break-words">{folderName}</p>
              </div>
              <FavoritesTab folderId={folderId} userId={userId} />
            </>
          )}
        </div>

        <div className="h-safe-bottom sm:hidden" />
      </div>

      {showMaxModal && selectedClient && (
        <MaxMessageModal
          client={selectedClient}
          shareUrl={shareUrl}
          expiryText={getExpiryText()}
          onSend={onSendViaMax}
          onClose={() => setShowMaxModal(false)}
        />
      )}
    </div>
  );
}
