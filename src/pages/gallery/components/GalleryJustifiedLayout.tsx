import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GalleryPhotoCard from './GalleryPhotoCard';
import { getThumbUrl } from '@/utils/imageThumb';
import { Photo, WatermarkSettings } from '../GalleryGrid';

interface GalleryJustifiedLayoutProps {
  photos: Photo[];
  gridGap: number;
  gridSize?: number;
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
  gridSize = 280,
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

  const RAW_EXTS = ['.cr2', '.nef', '.arw', '.dng', '.orf', '.raf', '.rw2', '.cr3'];
  const isRaw = (p: Photo) => RAW_EXTS.some(ext => p.file_name.toLowerCase().endsWith(ext));
  const allRaw = sortedPhotos.length > 0 && sortedPhotos.every(isRaw);

  // Для RAW-файлов без метаданных — определяем ориентацию по thumbnail
  const [detectedRatios, setDetectedRatios] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!allRaw) return;
    const missing = sortedPhotos.filter(p => !p.width || !p.height);
    if (missing.length === 0) return;

    let cancelled = false;
    const buffer: Record<number, number> = {};
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (cancelled || Object.keys(buffer).length === 0) return;
      setDetectedRatios(prev => ({ ...prev, ...buffer }));
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, 300);
    };

    // Грузим thumbnail'ы порциями, чтобы не вешать браузер
    let idx = 0;
    const CONCURRENCY = 6;
    let active = 0;

    const loadNext = () => {
      if (cancelled) return;
      while (active < CONCURRENCY && idx < missing.length) {
        const p = missing[idx++];
        const src = p.thumbnail_url || getThumbUrl(p.photo_url, 200);
        if (!src) continue;
        active++;
        const img = new Image();
        const done = (ratio?: number) => {
          if (ratio) buffer[p.id] = ratio;
          active--;
          scheduleFlush();
          loadNext();
        };
        img.onload = () => done(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : undefined);
        img.onerror = () => done();
        img.src = src;
      }
    };

    loadNext();

    return () => {
      cancelled = true;
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [allRaw, sortedPhotos]);

  const getAR = (p: Photo): number => {
    if (p.width && p.height) return p.width / p.height;
    if (detectedRatios[p.id]) return detectedRatios[p.id];
    // Пока thumbnail не загрузился — считаем горизонтальным (3:2 типично для зеркалки)
    return 3 / 2;
  };

  const targetHeight = gridSize;

  // Контейнер растягивается под реальную ширину экрана (без жёсткого лимита 1280),
  // ширину измеряем по контейнеру и обновляем при ресайзе/повороте экрана.
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth - 32 : 1200
  );

  useEffect(() => {
    const measure = () => {
      const w = containerElRef.current?.clientWidth;
      if (w && w > 0) setMeasuredWidth(w);
      else if (typeof window !== 'undefined') setMeasuredWidth(window.innerWidth - 32);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  const containerWidth = measuredWidth;

  const justifiedRows: { photos: Photo[]; height: number; fill?: boolean }[] = [];

  // Единый justified-алгоритм для всех фото, включая RAW.
  // getAR() для RAW определяет соотношение сторон по thumbnail, поэтому
  // gridSize (targetHeight) корректно влияет на размер всех типов файлов.
  {
    let currentRow: Photo[] = [];
    let currentAR = 0;

    sortedPhotos.forEach((photo, i) => {
      const ar = getAR(photo);
      currentRow.push(photo);
      currentAR += ar;

      const gaps = currentRow.length > 1 ? (currentRow.length - 1) * gridGap : 0;
      const rowHeight = (containerWidth - gaps) / currentAR;

      const isLastPhoto = i === sortedPhotos.length - 1;
      const rowIsFull = rowHeight <= targetHeight;

      if (rowIsFull || isLastPhoto) {
        if (rowIsFull) {
          // Полный ряд — растягиваем фото на всю ширину (justified).
          justifiedRows.push({ photos: [...currentRow], height: rowHeight, fill: true });
        } else {
          // Неполный последний ряд — НЕ раздуваем фото на всю ширину,
          // фиксируем высоту targetHeight и выравниваем слева.
          justifiedRows.push({ photos: [...currentRow], height: targetHeight, fill: false });
        }
        currentRow = [];
        currentAR = 0;
      }
    });
  }

  let globalIndex = 0;
  return (
    <div ref={containerElRef} className="w-full">
      {justifiedRows.map((row, rowIdx) => {
        const gaps = row.photos.length > 1 ? (row.photos.length - 1) * gridGap : 0;
        const availW = containerWidth - gaps;
        const totalAR = row.photos.reduce((sum, p) => sum + getAR(p), 0);
        // Неполный последний ряд: не растягиваем фото на всю ширину, выравниваем слева.
        const noStretch = row.fill === false;

        return (
          <div
            key={`row-${rowIdx}`}
            className={`flex ${noStretch ? 'justify-start' : ''}`}
            style={{ gap: `${gridGap}px`, marginBottom: `${gridGap}px` }}
          >
            {row.photos.map(photo => {
              const ar = getAR(photo);
              const idx = globalIndex++;
              const isL = ar > 1.15;

              if (noStretch) {
                // Естественный размер по фиксированной высоте ряда (targetHeight).
                const wPx = row.height * ar;
                const widthPct = Math.min((wPx / containerWidth) * 100, 100);
                return (
                  <div key={photo.id} style={{ width: `${widthPct}%`, flexShrink: 0, flexGrow: 0 }}>
                    <GalleryPhotoCard ref={photoCardRef} photo={photo} index={idx} gridGap={0} isDarkBg={isDarkBg}
                      screenshotProtection={screenshotProtection} downloadDisabled={downloadDisabled}
                      watermark={watermark} onPhotoClick={onPhotoClick} onDownloadPhoto={onDownloadPhoto}
                      onAddToFavorites={onAddToFavorites} onPhotoLoad={onPhotoLoad} selectionMode={selectionMode}
                      isSelected={selectedIds.has(photo.id)} onToggleSelect={onToggleSelect} isLandscape={isL} />
                  </div>
                );
              }

              const w = (ar / totalAR) * availW;
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
    </div>
  );
}