import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/icon';
import GalleryPhotoViewer from '@/components/gallery/GalleryPhotoViewer';

const CLIENT_UPLOAD_URL = 'https://functions.poehali.dev/06dd3267-2ef6-45bc-899c-50f86e9d36e1';

interface UploadedPhoto {
  photo_id: number;
  file_name: string;
  s3_url: string;
}

interface ClientFolderPageProps {
  folderId: number;
  folderName: string;
  shortCode: string;
  clientId: number;
  onBack: () => void;
  bgStyles?: React.CSSProperties;
  isDarkBg?: boolean;
  textColor?: string;
}

export default function ClientFolderPage({
  folderId,
  folderName,
  shortCode,
  clientId,
  onBack,
  bgStyles = {},
  isDarkBg = false,
  textColor = '#111827',
}: ClientFolderPageProps) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerPhotoId, setViewerPhotoId] = useState<number | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const animatedSet = useRef<Set<Element>>(new Set());
  const pendingNodes = useRef<Set<HTMLDivElement>>(new Set());

  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !animatedSet.current.has(entry.target)) {
              animatedSet.current.add(entry.target);
              const el = entry.target as HTMLElement;
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            }
          });
        },
        { threshold: 0.05, rootMargin: '80px' }
      );
      pendingNodes.current.forEach(n => observerRef.current!.observe(n));
      pendingNodes.current.clear();
    }
    return observerRef.current;
  }, []);

  useEffect(() => {
    getObserver();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [getObserver]);

  const photoCardRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (observerRef.current) {
      observerRef.current.observe(node);
    } else {
      pendingNodes.current.add(node);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(CLIENT_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'client_list_photos',
        short_code: shortCode,
        client_id: clientId,
        upload_folder_id: folderId,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setPhotos((data?.photos || []).map((p: UploadedPhoto) => ({
          photo_id: p.photo_id,
          file_name: p.file_name,
          s3_url: p.s3_url,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [folderId, shortCode, clientId]);

  const secondaryText = isDarkBg ? 'rgba(255,255,255,0.55)' : 'rgba(107,114,128,1)';

  const viewerPhotos = photos.map(p => ({
    id: p.photo_id,
    file_name: p.file_name,
    photo_url: p.s3_url,
    thumbnail_url: p.s3_url,
    file_size: 0,
  }));

  return (
    <div className="min-h-screen" style={{ ...bgStyles, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{ background: isDarkBg ? 'rgba(0,0,0,0.7)' : 'rgba(249,250,251,0.9)', backdropFilter: 'blur(10px)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
          style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
        >
          <Icon name="ArrowLeft" size={18} style={{ color: textColor }} />
        </button>
        <div>
          <h2 className="font-semibold text-base leading-tight" style={{ color: textColor }}>
            {folderName}
          </h2>
          {!loading && (
            <p className="text-xs" style={{ color: secondaryText }}>
              {photos.length} {photos.length === 1 ? 'фото' : photos.length < 5 ? 'фото' : 'фото'}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Icon name="Loader2" size={32} className="animate-spin" style={{ color: textColor, opacity: 0.5 }} />
        </div>
      )}

      {!loading && photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Icon name="ImageOff" size={40} style={{ color: textColor, opacity: 0.3 }} />
          <p className="text-sm" style={{ color: secondaryText }}>Фото ещё не добавлены</p>
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div
          className="columns-2 sm:columns-3 md:columns-4 px-2 pt-4 pb-8"
          style={{ columnGap: '8px' }}
        >
          {photos.map((photo, index) => (
            <div
              key={photo.photo_id}
              ref={photoCardRef}
              className="relative group rounded-lg overflow-hidden cursor-pointer break-inside-avoid touch-manipulation"
              style={{
                marginBottom: '8px',
                background: isDarkBg ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                opacity: 0,
                transform: 'translateY(24px)',
                transition: `opacity 0.5s ease ${(index % 8) * 0.06}s, transform 0.5s ease ${(index % 8) * 0.06}s`,
              }}
              onClick={() => setViewerPhotoId(photo.photo_id)}
            >
              <img
                src={photo.s3_url}
                alt={photo.file_name}
                className="w-full h-auto transition-transform group-hover:scale-105"
                loading="lazy"
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
                className="absolute bottom-1.5 right-1.5 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-blue-500 transition-colors touch-manipulation"
                style={{ width: '22px', height: '22px', minWidth: '22px' }}
                title="Скачать"
              >
                <Icon name="Download" size={11} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {viewerPhotoId !== null && (
        <GalleryPhotoViewer
          photos={viewerPhotos}
          initialPhotoId={viewerPhotoId}
          onClose={() => setViewerPhotoId(null)}
          onDownload={(photo) => {
            const a = document.createElement('a');
            a.href = photo.photo_url;
            a.download = photo.file_name;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          downloadDisabled={false}
        />
      )}
    </div>
  );
}