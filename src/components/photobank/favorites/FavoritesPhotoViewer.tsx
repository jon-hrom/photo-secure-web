import PhotoGridViewer from '../PhotoGridViewer';
import { resolveClientPhotos } from './useFavoritesData';
import type { ClientData, Photo } from './useFavoritesData';

interface FavoritesPhotoViewerProps {
  selectedPhoto: Photo;
  selectedClient: ClientData;
  allPhotos: Photo[];
  onClose: () => void;
  onDownload: (photo: Photo) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export default function FavoritesPhotoViewer({
  selectedPhoto,
  selectedClient,
  allPhotos,
  onClose,
  onDownload,
  onNavigate
}: FavoritesPhotoViewerProps) {
  const displayPhotos = resolveClientPhotos(selectedClient, allPhotos);

  // PhotoGridViewer ждёт свой формат фото (s3_url / thumbnail_s3_url / s3_key и т.д.),
  // поэтому приводим избранные фото клиента к этому виду.
  const viewerPhotos = displayPhotos.map((p) => {
    let s3_key = p.s3_key || p.photo_url.split('/bucket/')[1] || p.photo_url.split('/').slice(-3).join('/');
    s3_key = s3_key.split('?')[0];

    return {
      id: p.id,
      file_name: p.file_name,
      s3_url: p.photo_url,
      s3_key,
      // Открываем среднее качество (preview ~2400px): чётче миниатюры,
      // но быстрее оригинала. Оригинал подгрузится при зуме.
      thumbnail_s3_url: p.preview_url || p.thumbnail_url,
      is_raw: false,
      file_size: 0,
      width: null,
      height: null,
      created_at: new Date().toISOString()
    };
  });

  const viewerPhoto = viewerPhotos.find((p) => p.id === selectedPhoto.id) || null;

  return (
    <PhotoGridViewer
      viewPhoto={viewerPhoto}
      photos={viewerPhotos}
      onClose={onClose}
      onNavigate={onNavigate}
      onDownload={async () => {
        onDownload(selectedPhoto);
      }}
      formatBytes={(bytes) => {
        if (bytes === 0) return 'N/A';
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
      }}
    />
  );
}