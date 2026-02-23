import GalleryPhotoViewer from '@/components/gallery/GalleryPhotoViewer';
import ClientUploadHeader from '@/components/gallery/ClientUploadHeader';
import ClientUploadContent from '@/components/gallery/ClientUploadContent';
import { useClientUploadState, ClientUploadFolder } from './useClientUploadState';
import { useClientUploadHandlers, useFileUploadHandler } from './useClientUploadHandlers';

interface ClientUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortCode: string;
  clientId: number;
  existingFolders: ClientUploadFolder[];
  onFoldersUpdate: (folders: ClientUploadFolder[]) => void;
  isDarkTheme?: boolean;
  initialFolderId?: number;
  initialFolderName?: string;
}

export default function ClientUploadModal({
  isOpen,
  onClose,
  shortCode,
  clientId,
  existingFolders,
  onFoldersUpdate,
  isDarkTheme = false,
  initialFolderId,
  initialFolderName
}: ClientUploadModalProps) {
  const state = useClientUploadState();

  const { handleFilesSelected } = useFileUploadHandler({
    shortCode,
    clientId,
    activeFolderId: state.activeFolderId,
    activeFolderName: state.activeFolderName,
    existingFolders,
    onFoldersUpdate,
    setUploading: state.setUploading,
    setUploadProgress: state.setUploadProgress,
    setUploadedPhotos: state.setUploadedPhotos,
  });

  const handlers = useClientUploadHandlers({
    shortCode,
    clientId,
    isOpen,
    initialFolderId,
    initialFolderName,
    existingFolders,
    onFoldersUpdate,
    newFolderName: state.newFolderName,
    clientName: state.clientName,
    activeFolderId: state.activeFolderId,
    activeFolderName: state.activeFolderName,
    renameValue: state.renameValue,
    setStep: state.setStep,
    setActiveFolderId: state.setActiveFolderId,
    setActiveFolderName: state.setActiveFolderName,
    setUploadedPhotos: state.setUploadedPhotos,
    setViewingOtherFolder: state.setViewingOtherFolder,
    setRenamingFolder: state.setRenamingFolder,
    setUploading: state.setUploading,
    setUploadProgress: state.setUploadProgress,
    setDeletingPhotoId: state.setDeletingPhotoId,
    setIsDragOver: state.setIsDragOver,
    setLoadingPhotos: state.setLoadingPhotos,
    setCheckingOwnFolder: state.setCheckingOwnFolder,
    handleFilesSelected,
  });

  if (!isOpen) return null;

  const viewerPhotos = state.uploadedPhotos.map(p => ({
    id: p.photo_id,
    file_name: p.file_name,
    photo_url: p.s3_url,
    file_size: 0
  }));

  const bg = 'bg-[#1a1a2e]';
  const headerBg = 'bg-[#1a1a2e] border-white/10';
  const text = 'text-white';
  const subText = 'text-gray-400';
  const cardBg = 'bg-white/8 border-white/10';
  const inputCls = 'bg-white/10 border-white/15 text-white placeholder:text-gray-500 focus:border-blue-400';
  const hoverCard = 'hover:border-blue-400/60 hover:bg-white/12';
  const hoverBtn = 'hover:bg-white/10';

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
        <div className={`${bg} ${text} rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-white/10`}>
          <ClientUploadHeader
            step={state.step}
            activeFolderName={state.activeFolderName}
            headerBg={headerBg}
            hoverBtn={hoverBtn}
            onBack={() => {
              if (state.step === 'rename') {
                state.setStep('upload');
              } else {
                state.setStep('folders');
                state.setUploadedPhotos([]);
                state.setViewingOtherFolder(false);
              }
            }}
            onClose={onClose}
          />

          <ClientUploadContent
            step={state.step}
            checkingOwnFolder={state.checkingOwnFolder}
            existingFolders={existingFolders}
            newFolderName={state.newFolderName}
            clientName={state.clientName}
            renameValue={state.renameValue}
            renamingFolder={state.renamingFolder}
            uploading={state.uploading}
            uploadProgress={state.uploadProgress}
            uploadedPhotos={state.uploadedPhotos}
            loadingPhotos={state.loadingPhotos}
            deletingPhotoId={state.deletingPhotoId}
            isDragOver={state.isDragOver}
            activeFolderName={state.activeFolderName}
            subText={subText}
            cardBg={cardBg}
            hoverCard={hoverCard}
            inputCls={inputCls}
            onSelectFolder={handlers.handleSelectFolder}
            onViewOtherFolder={handlers.handleViewOtherFolder}
            onCreateFolder={() => state.setStep('create')}
            onChangeFolderName={state.setNewFolderName}
            onChangeClientName={state.setClientName}
            onSubmitCreate={handlers.handleCreateFolder}
            onChangeRenameValue={state.setRenameValue}
            onSubmitRename={handlers.handleRenameFolder}
            onFilesSelected={handleFilesSelected}
            onDeletePhoto={handlers.handleDeletePhoto}
            onViewPhoto={state.setViewerPhotoId}
            onDragOver={handlers.handleDragOver}
            onDragLeave={handlers.handleDragLeave}
            onDrop={handlers.handleDrop}
            onRenameClick={() => { state.setRenameValue(state.activeFolderName); state.setStep('rename'); }}
            onGoToCreate={() => state.setStep('create')}
          />

          <div className="h-safe-bottom sm:hidden" />
        </div>
      </div>

      {state.viewerPhotoId !== null && viewerPhotos.length > 0 && (
        <GalleryPhotoViewer
          photos={viewerPhotos}
          initialPhotoId={state.viewerPhotoId}
          onClose={() => state.setViewerPhotoId(null)}
          downloadDisabled={false}
        />
      )}
    </>
  );
}
