interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  photo_download_count?: number;
}

interface PhotoGridInfoProps {
  viewPhoto: Photo;
  isLandscape: boolean;
  formatBytes: (bytes: number) => string;
}

const PhotoGridInfo = ({
  viewPhoto,
  isLandscape,
  formatBytes
}: PhotoGridInfoProps) => {
  if (isLandscape) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 sm:p-4 md:p-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 md:pb-6">
      <p className="text-white font-medium text-sm sm:text-lg mb-1 sm:mb-2 truncate">{viewPhoto.file_name}</p>
      <div className="flex items-center gap-2 sm:gap-4 text-white/70 text-xs sm:text-sm flex-wrap">
        <span>{formatBytes(viewPhoto.file_size)}</span>
        {viewPhoto.width && viewPhoto.height && (
          <span>{viewPhoto.width} × {viewPhoto.height}</span>
        )}
        {(viewPhoto.photo_download_count ?? 0) > 0 && (
          <span className="text-emerald-400 font-medium">📥 {viewPhoto.photo_download_count} скачиваний</span>
        )}
      </div>
    </div>
  );
};

export default PhotoGridInfo;