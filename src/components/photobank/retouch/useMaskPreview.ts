import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';

interface UseMaskPreviewArgs {
  userId: string;
  currentPreviewPhotoId: number | string | undefined;
}

export function useMaskPreview({ userId, currentPreviewPhotoId }: UseMaskPreviewArgs) {
  const [showMaskPreview, setShowMaskPreview] = useState(false);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState<string | null>(null);
  const [maskPreviewLoading, setMaskPreviewLoading] = useState(false);
  const maskPreviewCacheRef = useRef<Map<number | string, string>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    setMaskPreviewUrl(null);
  }, [currentPreviewPhotoId]);

  useEffect(() => {
    if (!showMaskPreview || !currentPreviewPhotoId) {
      setMaskPreviewUrl(null);
      setMaskPreviewLoading(false);
      return;
    }
    const photoId = currentPreviewPhotoId;
    const cached = maskPreviewCacheRef.current.get(photoId);
    if (cached) {
      setMaskPreviewUrl(cached);
      return;
    }
    let cancelled = false;
    setMaskPreviewLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${RETOUCH_API}?action=preview_mask&photo_id=${photoId}`,
          { headers: { 'X-User-Id': userId } }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Не удалось построить маску');
        }
        const data = await res.json();
        if (cancelled || !data.mask_b64) return;
        const dataUrl = `data:image/png;base64,${data.mask_b64}`;
        maskPreviewCacheRef.current.set(photoId, dataUrl);
        setMaskPreviewUrl(dataUrl);
      } catch (e) {
        if (!cancelled) {
          toast({
            title: 'Не удалось показать маску',
            description: e instanceof Error ? e.message : 'Ошибка',
            variant: 'destructive',
          });
          setShowMaskPreview(false);
        }
      } finally {
        if (!cancelled) setMaskPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showMaskPreview, currentPreviewPhotoId, userId, toast]);

  return {
    showMaskPreview,
    setShowMaskPreview,
    maskPreviewUrl,
    maskPreviewLoading,
  };
}
