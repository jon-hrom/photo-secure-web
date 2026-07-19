import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { REVIEW_OCCASIONS } from '@/data/reviewPrompts';
import { fetchGalleryPhotos, GalleryPhotoLite } from '@/lib/galleryPhotos';
import { submitReview } from '@/lib/portfolioApi';

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  accent: string;
  /** Предзаполнение из галереи: код, пароль и контакт клиента */
  galleryCode?: string;
  galleryPassword?: string;
  clientId?: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
}

const ReviewFormDialog = ({
  open, onClose, slug, accent,
  galleryCode, galleryPassword: galleryPasswordProp,
  clientId, clientName, clientPhone, clientEmail,
}: Props) => {
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [author, setAuthor] = useState('');
  const [occasionId, setOccasionId] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Фото из галереи
  const [galleryLink, setGalleryLink] = useState('');
  const [galleryPassword, setGalleryPassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhotoLite[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [galleryError, setGalleryError] = useState('');

  const occasion = REVIEW_OCCASIONS.find((o) => o.id === occasionId);
  const ratingLabels = ['', 'Очень плохо', 'Плохо', 'Нормально', 'Хорошо', 'Замечательно'];

  const reset = () => {
    setStep('form'); setAuthor(''); setOccasionId(''); setRating(0); setHover(0);
    setText(''); setError(''); setGalleryLink(''); setGalleryPassword('');
    setNeedPassword(false); setGalleryPhotos([]); setSelected({}); setGalleryError('');
  };

  const close = () => { onClose(); setTimeout(reset, 300); };

  const loadPhotosFrom = useCallback(async (linkOrCode: string, pwd?: string) => {
    if (!linkOrCode) return;
    setLoadingPhotos(true);
    setGalleryError('');
    const r = await fetchGalleryPhotos(linkOrCode, pwd || undefined);
    setLoadingPhotos(false);
    if (r.requiresPassword) { setNeedPassword(true); return; }
    if (!r.ok) {
      setGalleryError(r.error === 'bad_code' ? 'Проверьте ссылку на галерею' : 'Не удалось загрузить фото по ссылке');
      return;
    }
    setNeedPassword(false);
    setGalleryPhotos(r.photos);
    if (r.photos.length === 0) setGalleryError('В галерее нет фотографий');
  }, []);

  const loadPhotos = () => loadPhotosFrom(galleryLink, galleryPassword);

  // Предзаполнение из галереи: имя клиента + автозагрузка фото по коду
  useEffect(() => {
    if (!open) return;
    if (clientName) setAuthor((a) => a || clientName);
    if (galleryCode) {
      setGalleryLink(galleryCode);
      loadPhotosFrom(galleryCode, galleryPasswordProp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, galleryCode, clientName]);

  const togglePhoto = (p: GalleryPhotoLite) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p.id]) { delete next[p.id]; return next; }
      if (Object.keys(next).length >= 6) return prev;
      next[p.id] = p.photo_url;
      return next;
    });
  };

  const submit = async () => {
    setError('');
    if (!author.trim()) { setError('Укажите ваше имя'); return; }
    if (rating === 0) { setError('Поставьте оценку звёздами'); return; }
    if (!text.trim()) { setError('Напишите пару слов'); return; }
    setSaving(true);
    const r = await submitReview({
      slug,
      author_name: author.trim(),
      text: text.trim(),
      rating,
      shooting_style: occasion?.label || '',
      photos: Object.values(selected),
      client_id: clientId,
      client_phone: clientPhone,
      client_email: clientEmail,
      gallery_code: galleryCode,
    });
    setSaving(false);
    if (!r.ok) { setError('Не удалось отправить, попробуйте ещё раз'); return; }
    setStep('done');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg w-[calc(100%-1rem)] rounded-2xl max-h-[90vh] overflow-y-auto">
        {step === 'done' ? (
          <div className="text-center py-6 px-2">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: accent }}>
              <Icon name="Heart" size={30} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Спасибо за эмоции!</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Ваш отзыв отправлен фотографу. После проверки он появится на странице.
            </p>
            <Button onClick={close} className="w-full" style={{ background: accent }}>Готово</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Оставить эмоции</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Как вас зовут?</label>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ваше имя" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Какая была съёмка?</label>
                <div className="flex flex-wrap gap-1.5">
                  {REVIEW_OCCASIONS.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setOccasionId(o.id === occasionId ? '' : o.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border transition ${
                        occasionId === o.id
                          ? 'text-white border-transparent'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                      style={occasionId === o.id ? { background: accent } : undefined}
                    >
                      {o.emoji} {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ваша оценка</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}
                      className="p-0.5"
                    >
                      <Icon
                        name="Star"
                        size={30}
                        className={(hover || rating) >= n ? 'text-amber-400' : 'text-gray-300'}
                        fill={(hover || rating) >= n ? '#fbbf24' : 'none'}
                      />
                    </button>
                  ))}
                  {(hover || rating) > 0 && (
                    <span className="text-sm text-muted-foreground ml-2">{ratingLabels[hover || rating]}</span>
                  )}
                </div>
              </div>

              {occasion && (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Icon name="Lightbulb" size={13} /> Подсказки, о чём написать
                  </p>
                  <ul className="space-y-1">
                    {occasion.questions.map((q) => (
                      <li key={q} className="text-xs text-gray-600 flex gap-1.5">
                        <span style={{ color: accent }}>•</span> {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ваш отзыв</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder="Поделитесь эмоциями и впечатлениями от съёмки..."
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm resize-y"
                />
              </div>

              {/* Фото из галереи */}
              <div className="space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Icon name="Images" size={15} style={{ color: accent }} /> Прикрепить любимые фото <span className="text-xs font-normal text-muted-foreground">(необязательно)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Вставьте ссылку на вашу галерею от фотографа — и выберите кадры, которые понравились больше всего.
                </p>
                {galleryPhotos.length === 0 ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={galleryLink} onChange={(e) => setGalleryLink(e.target.value)} placeholder="Ссылка на галерею" className="h-9 text-sm" />
                      <Button size="sm" variant="outline" onClick={loadPhotos} disabled={loadingPhotos || !galleryLink.trim()}>
                        {loadingPhotos ? <Icon name="Loader2" size={15} className="animate-spin" /> : 'Открыть'}
                      </Button>
                    </div>
                    {needPassword && (
                      <Input value={galleryPassword} onChange={(e) => setGalleryPassword(e.target.value)} placeholder="Пароль от галереи" type="password" className="h-9 text-sm" />
                    )}
                    {galleryError && <p className="text-xs text-red-500">{galleryError}</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Выбрано {Object.keys(selected).length} из 6</p>
                    <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto">
                      {galleryPhotos.map((p) => {
                        const isSel = !!selected[p.id];
                        return (
                          <button
                            key={p.id}
                            onClick={() => togglePhoto(p)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${isSel ? 'border-transparent ring-2' : 'border-transparent'}`}
                            style={isSel ? { ['--tw-ring-color' as string]: accent, boxShadow: `0 0 0 2px ${accent}` } : undefined}
                          >
                            <img src={p.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                            {isSel && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Icon name="Check" size={18} className="text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button onClick={submit} disabled={saving} className="w-full text-white" style={{ background: accent }}>
                {saving ? 'Отправляем...' : 'Отправить отзыв'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReviewFormDialog;