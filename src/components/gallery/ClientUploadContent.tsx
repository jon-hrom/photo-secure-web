import Icon from '@/components/ui/icon';
import ClientUploadStepFolders from '@/components/gallery/ClientUploadStepFolders';
import { ClientUploadStepCreate, ClientUploadStepRename } from '@/components/gallery/ClientUploadStepCreate';
import ClientUploadStepUpload from '@/components/gallery/ClientUploadStepUpload';
import ClientUploadStepView from '@/components/gallery/ClientUploadStepView';
import { ClientUploadFolder, UploadStep, UploadedPhoto } from './useClientUploadState';

interface ClientUploadContentProps {
  step: UploadStep;
  checkingOwnFolder: boolean;
  existingFolders: ClientUploadFolder[];
  newFolderName: string;
  clientName: string;
  renameValue: string;
  renamingFolder: boolean;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  uploadedPhotos: UploadedPhoto[];
  loadingPhotos: boolean;
  deletingPhotoId: number | null;
  isDragOver: boolean;
  activeFolderName: string;
  subText: string;
  cardBg: string;
  hoverCard: string;
  inputCls: string;
  onSelectFolder: (folder: ClientUploadFolder) => void;
  onViewOtherFolder: (folder: ClientUploadFolder) => void;
  onCreateFolder: () => void;
  onChangeFolderName: (v: string) => void;
  onChangeClientName: (v: string) => void;
  onSubmitCreate: () => void;
  onChangeRenameValue: (v: string) => void;
  onSubmitRename: () => void;
  onFilesSelected: (files: FileList | null) => Promise<void>;
  onDeletePhoto: (id: number) => void;
  onViewPhoto: (id: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRenameClick: () => void;
  onGoToCreate: () => void;
}

export default function ClientUploadContent({
  step,
  checkingOwnFolder,
  existingFolders,
  newFolderName,
  clientName,
  renameValue,
  renamingFolder,
  uploading,
  uploadProgress,
  uploadedPhotos,
  loadingPhotos,
  deletingPhotoId,
  isDragOver,
  activeFolderName,
  subText,
  cardBg,
  hoverCard,
  inputCls,
  onSelectFolder,
  onViewOtherFolder,
  onCreateFolder,
  onChangeFolderName,
  onChangeClientName,
  onSubmitCreate,
  onChangeRenameValue,
  onSubmitRename,
  onFilesSelected,
  onDeletePhoto,
  onViewPhoto,
  onDragOver,
  onDragLeave,
  onDrop,
  onRenameClick,
  onGoToCreate,
}: ClientUploadContentProps) {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      {checkingOwnFolder && (
        <div className="flex items-center justify-center py-16">
          <Icon name="Loader2" size={28} className="animate-spin text-gray-500" />
        </div>
      )}

      {!checkingOwnFolder && step === 'folders' && (
        <ClientUploadStepFolders
          existingFolders={existingFolders}
          subText={subText}
          cardBg={cardBg}
          hoverCard={hoverCard}
          onSelectFolder={onSelectFolder}
          onViewOtherFolder={onViewOtherFolder}
          onCreateFolder={onCreateFolder}
        />
      )}

      {step === 'create' && (
        <ClientUploadStepCreate
          newFolderName={newFolderName}
          clientName={clientName}
          inputCls={inputCls}
          subText={subText}
          onChangeFolderName={onChangeFolderName}
          onChangeClientName={onChangeClientName}
          onSubmit={onSubmitCreate}
        />
      )}

      {step === 'rename' && (
        <ClientUploadStepRename
          renameValue={renameValue}
          renamingFolder={renamingFolder}
          inputCls={inputCls}
          subText={subText}
          onChangeRenameValue={onChangeRenameValue}
          onSubmit={onSubmitRename}
        />
      )}

      {step === 'upload' && (
        <ClientUploadStepUpload
          uploading={uploading}
          uploadProgress={uploadProgress}
          uploadedPhotos={uploadedPhotos}
          loadingPhotos={loadingPhotos}
          deletingPhotoId={deletingPhotoId}
          isDragOver={isDragOver}
          activeFolderName={activeFolderName}
          subText={subText}
          onFilesSelected={onFilesSelected}
          onDeletePhoto={onDeletePhoto}
          onViewPhoto={onViewPhoto}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onRenameClick={onRenameClick}
          onCreateFolder={onGoToCreate}
        />
      )}

      {step === 'view' && (
        <ClientUploadStepView
          uploadedPhotos={uploadedPhotos}
          loadingPhotos={loadingPhotos}
          subText={subText}
          onViewPhoto={onViewPhoto}
        />
      )}
    </div>
  );
}
