import { useCallback, useEffect, useMemo, useRef } from 'react';
import GalleryPhotoCard from './GalleryPhotoCard';
import { Photo, WatermarkSettings } from '../GalleryGrid';

interface GalleryJustifiedLayoutProps {
  photos: Photo[];
  gridGap: number;
  isDarkBg: boolean;
  screenshotProtection?: boolean;
  downloadDisabled?: boolean;
  watermark?: WatermarkSettings;
  onPhotoClick: (photo: Photo) => void;
  onDownloadPhoto: (photo: Photo) => void;
  onAddToFavorites: (photo: Photo) => void;
  onPhotoLoad?: () => void;
  selectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (photo: Photo) => void;
}

export default function GalleryJustifiedLayout({
  photos,
  gridGap,
  isDarkBg,
  screenshotProtection,
  downloadDisabled,
  watermark,
  onPhotoClick,
  onDownloadPhoto,
  onAddToFavorites,
  onPhotoLoad,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: GalleryJustifiedLayoutProps) {
  const pendingNodes = useRef<Set<HTMLDivElement>>(new Set());
  const animatedSet = useRef<Set<Element>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

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
        { threshold: 0, rootMargin: '400px' }
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

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const re = /(\d+)|(\D+)/g;
      const aParts = a.file_name.toLowerCase().match(re) || [];
      const bParts = b.file_name.toLowerCase().match(re) || [];
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        if (i >= aParts.length) return -1;
        if (i >= bParts.length) return 1;
        const aNum = parseInt(aParts[i]);
        const bNum = parseInt(bParts[i]);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum;
        } else {
          const cmp = aParts[i].localeCompare(bParts[i]);
          if (cmp !== 0) return cmp;
        }
      }
      return 0;
    });
  }, [photos]);

  const targetHeight = 280;
  const containerWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 32, 1280) : 1200;

  const justifiedRows: { photos: Photo[]; height: number }[] = [];
  let currentRow: Photo[] = [];
  let currentAR = 0;

  sortedPhotos.forEach((photo, i) => {
    const ar = (photo.width || 1) / (photo.height || 1);
    currentRow.push(photo);
    currentAR += ar;

    const gaps = currentRow.length > 1 ? (currentRow.length - 1) * gridGap : 0;
    const rowHeight = (containerWidth - gaps) / currentAR;

    if (rowHeight <= targetHeight || i === sortedPhotos.length - 1) {
      const finalHeight = i === sortedPhotos.length - 1 && rowHeight > targetHeight * 1.5
        ? targetHeight
        : rowHeight;
      justifiedRows.push({ photos: [...currentRow], height: finalHeight });
      currentRow = [];
      currentAR = 0;
    }
  });

  let globalIndex = 0;
  return (
    <>
      {justifiedRows.map((row, rowIdx) => {
        const gaps = row.photos.length > 1 ? (row.photos.length - 1) * gridGap : 0;
        const availW = containerWidth - gaps;
        const totalAR = row.photos.reduce((sum, p) => sum + (p.width || 1) / (p.height || 1), 0);

        return (
          <div key={`row-${rowIdx}`} className="flex" style={{ gap: `${gridGap}px`, marginBottom: `${gridGap}px` }}>
            {row.photos.map(photo => {
              const ar = (photo.width || 1) / (photo.height || 1);
              const w = (ar / totalAR) * availW;
              const idx = globalIndex++;
              const isL = ar > 1.15;
              return (
                <div key={photo.id} style={{ width: `${(w / containerWidth) * 100}%`, flexShrink: 0, flexGrow: 1 }}>
                  <GalleryPhotoCard ref={photoCardRef} photo={photo} index={idx} gridGap={0} isDarkBg={isDarkBg}
                    screenshotProtection={screenshotProtection} downloadDisabled={downloadDisabled}
                    watermark={watermark} onPhotoClick={onPhotoClick} onDownloadPhoto={onDownloadPhoto}
                    onAddToFavorites={onAddToFavorites} onPhotoLoad={onPhotoLoad} selectionMode={selectionMode}
                    isSelected={selectedIds.has(photo.id)} onToggleSelect={onToggleSelect} isLandscape={isL} />
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
