import { useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface UploadedPhoto {
  photo_id: number;
  file_name: string;
  s3_url: string;
}

interface Props {
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  uploadedPhotos: UploadedPhoto[];
  loadingPhotos: boolean;
  deletingPhotoId: number | null;
  isDragOver: boolean;
  activeFolderName: string;
  subText: string;
  onFilesSelected: (files: FileList | null) => void;
  onDeletePhoto: (photoId: number) => void;
  onViewPhoto: (photoId: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRenameClick: () => void;
  onCreateFolder: () => void;
}

export default function ClientUploadStepUpload({
  uploading,
  uploadProgress,
  uploadedPhotos,
  loadingPhotos,
  deletingPhotoId,
  isDragOver,
  subText,
  onFilesSelected,
  onDeletePhoto,
  onViewPhoto,
  onDragOver,
  onDragLeave,
  onDrop,
  onRenameClick,
  onCreateFolder,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <button
        onClick={onRenameClick}
        className={`flex items-center gap-1.5 text-xs ${subText} hover:text-gray-200 transition-colors`}
      >
        <Icon name="Pencil" size={12} />
        Переименовать папку
      </button>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          isDragOver ? 'border-blue-400 bg-blue-500/10' : 'border-white/15'
        }`}
      >
        <div className="space-y-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-14 text-base bg-blue-600 hover:bg-blue-700 text-white"
          >
            {uploading ? (
              <>
                <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                Загрузка {uploadProgress.current}/{uploadProgress.total}...
              </>
            ) : (
              <>
                <Icon name="ImagePlus" size={20} className="mr-2" />
                Выбрать фото
              </>
            )}
          </Button>
          <p className={`text-xs text-center ${subText}`}>
            Максимальный размер одного файла: 50 МБ
          </p>
        </div>
        <p className="text-sm text-gray-600 mt-2">или перетащите файлы сюда</p>
      </div>

      {uploading && (
        <div className="w-full rounded-full h-1.5 bg-white/10">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
          />
        </div>
      )}

      {loadingPhotos && (
        <div className="flex items-center justify-center py-4">
          <Icon name="Loader2" size={20} className="animate-spin text-gray-500 mr-2" />
          <span className={`text-sm ${subText}`}>Загрузка фото...</span>
        </div>
      )}

      {!loadingPhotos && uploadedPhotos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-green-400">
            Фото в папке: {uploadedPhotos.length}
          </p>
          <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
            {uploadedPhotos.map((photo) => (
              <div key={photo.photo_id} className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer bg-white/8">
                <img
                  src={photo.s3_url}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                  onClick={() => onViewPhoto(photo.photo_id)}
                />
                <button
                  onClick={() => onDeletePhoto(photo.photo_id)}
                  disabled={deletingPhotoId === photo.photo_id}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {deletingPhotoId === photo.photo_id ? (
                    <Icon name="Loader2" size={12} className="animate-spin" />
                  ) : (
                    <Icon name="X" size={12} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className={`text-xs text-center ${subText}`}>
        Поддерживаются JPG, PNG, HEIC, MP4, MOV и другие форматы
      </p>

      <button
        onClick={onCreateFolder}
        className="w-full text-sm py-2 rounded-lg border border-dashed border-white/12 text-gray-600 hover:border-white/25 hover:text-gray-400 transition-all"
      >
        <Icon name="FolderPlus" size={14} className="inline mr-1.5" />
        Создать новую папку
      </button>
    </>
  );
}
