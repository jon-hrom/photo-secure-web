import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ReviewFormDialog from '@/components/portfolio/ReviewFormDialog';

interface ClientData {
  client_id: number;
  full_name?: string;
  phone?: string;
  email?: string;
}

interface Props {
  /** slug опубликованного портфолио фотографа (из ответа галереи) */
  portfolioSlug?: string | null;
  galleryCode?: string;
  galleryPassword?: string;
  clientData?: ClientData | null;
  accent?: string;
  /** true, когда клиент только что скачал все фото / архив */
  justDownloadedAll?: boolean;
  /** true, когда клиент просмотрел (пролистал) галерею целиком */
  viewedAll?: boolean;
}

const dismissKey = (code?: string) => `review_invite_dismissed_${code || 'x'}`;

/**
 * Красивое окно-приглашение оставить отзыв («эмоции»), которое появляется
 * после того как клиент просмотрел все фото или скачал их архивом.
 * Показывается один раз на галерею (запоминается в localStorage).
 */
const GalleryReviewInvite = ({
  portfolioSlug, galleryCode, galleryPassword, clientData, accent = '#7c3aed',
  justDownloadedAll, viewedAll,
}: Props) => {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const shownRef = useRef(false);

  const canShow = !!portfolioSlug && !!galleryCode;

  useEffect(() => {
    if (!canShow || shownRef.current) return;
    if (!justDownloadedAll && !viewedAll) return;
    try {
      if (localStorage.getItem(dismissKey(galleryCode))) { shownRef.current = true; return; }
    } catch { /* ignore */ }
    shownRef.current = true;
    // небольшая задержка, чтобы окно не перебивало анимацию скачивания
    const t = setTimeout(() => setInviteOpen(true), justDownloadedAll ? 900 : 400);
    return () => clearTimeout(t);
  }, [canShow, justDownloadedAll, viewedAll, galleryCode]);

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(galleryCode), '1'); } catch { /* ignore */ }
    setInviteOpen(false);
  };

  const openForm = () => {
    setInviteOpen(false);
    try { localStorage.setItem(dismissKey(galleryCode), '1'); } catch { /* ignore */ }
    setTimeout(() => setFormOpen(true), 150);
  };

  if (!canShow) return null;

  return (
    <>
      <Dialog open={inviteOpen} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-3xl overflow-hidden p-0 border-0">
          <div className="px-6 pt-8 pb-6 text-center relative">
            <div
              className="absolute inset-x-0 top-0 h-24 opacity-90"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}
            />
            <div className="relative">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg bg-white">
                <Icon name="Heart" size={38} style={{ color: accent }} />
              </div>
              <h3 className="text-xl font-bold mb-2">Как вам эмоции? 💛</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Если фотографии откликнулись — поделитесь парой тёплых слов.
                Ваш отзыв очень вдохновляет и помогает создавать ещё красивее.
                Можно прикрепить любимые кадры из этой галереи.
              </p>
              <Button
                onClick={openForm}
                className="w-full h-11 text-white rounded-xl gap-2"
                style={{ background: accent }}
              >
                <Icon name="Sparkles" size={18} />
                Оставить эмоции
              </Button>
              <button
                onClick={dismiss}
                className="mt-3 text-xs text-muted-foreground hover:underline"
              >
                Может быть, позже
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReviewFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        slug={portfolioSlug || ''}
        accent={accent}
        galleryCode={galleryCode}
        galleryPassword={galleryPassword}
        clientId={clientData?.client_id}
        clientName={clientData?.full_name}
        clientPhone={clientData?.phone}
        clientEmail={clientData?.email}
      />
    </>
  );
};

export default GalleryReviewInvite;
