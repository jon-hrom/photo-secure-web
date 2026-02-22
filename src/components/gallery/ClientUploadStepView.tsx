import Icon from '@/components/ui/icon';

interface UploadedPhoto {
  photo_id: number;
  file_name: string;
  s3_url: string;
}

interface Props {
  uploadedPhotos: UploadedPhoto[];
  loadingPhotos: boolean;
  subText: string;
  onViewPhoto: (photoId: number) => void;
}

export default function ClientUploadStepView({
  uploadedPhotos,
  loadingPhotos,
  subText,
  onViewPhoto,
}: Props) {
  return (
    <>
      <p className={`text-sm ${subText}`}>
        Фото загруженные участником
      </p>

      {loadingPhotos && (
        <div className="flex items-center justify-center py-8">
          <Icon name="Loader2" size={24} className="animate-spin text-gray-500 mr-2" />
          <span className={`text-sm ${subText}`}>Загрузка фото...</span>
        </div>
      )}

      {!loadingPhotos && uploadedPhotos.length === 0 && (
        <div className="rounded-xl p-8 text-center bg-white/5">
          <Icon name="ImageOff" size={32} className="mx-auto mb-2 text-gray-600" />
          <p className={`text-sm ${subText}`}>Фото ещё не добавлены</p>
        </div>
      )}

      {!loadingPhotos && uploadedPhotos.length > 0 && (
        <div className="space-y-2">
          <p className={`text-xs font-medium ${subText}`}>
            Фото в папке: {uploadedPhotos.length}
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {uploadedPhotos.map((photo) => (
              <div
                key={photo.photo_id}
                className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer bg-white/8"
                onClick={() => onViewPhoto(photo.photo_id)}
              >
                <img
                  src={photo.s3_url}
                  alt={photo.file_name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const a = document.createElement('a');
                    a.href = photo.s3_url;
                    a.download = photo.file_name;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="absolute bottom-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Скачать"
                >
                  <Icon name="Download" size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
