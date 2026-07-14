import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Portfolio, portfolioAction } from '@/lib/portfolioApi';
import PhotoBankPicker, { PickedPhoto } from './PhotoBankPicker';

interface Props {
  userId: string;
  portfolio: Portfolio;
  onChange: (p: Portfolio) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

type CoverTarget = { kind: 'category'; id: number; title: string } | { kind: 'shooting'; id: number; title: string };

const PortfolioPhotosManager = ({ userId, portfolio, onChange }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newShooting, setNewShooting] = useState('');
  // Навигация: activeCat=null → слайд-шоу; activeCat!=null && activeShooting=null → каталог съёмок; activeShooting!=null → фото съёмки
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [activeShooting, setActiveShooting] = useState<number | null>(null);
  const [coverTarget, setCoverTarget] = useState<CoverTarget | null>(null);
  const [bankOpen, setBankOpen] = useState(false);

  const categories = portfolio.categories || [];
  const shootings = portfolio.shootings || [];
  const allPhotos = portfolio.photos || [];

  const catShootings = shootings.filter((s) => s.category_id === activeCat);
  const activeCategory = categories.find((c) => c.id === activeCat) || null;
  const activeShootingObj = shootings.find((s) => s.id === activeShooting) || null;

  // Какие фото показываем в текущем виде
  const viewPhotos = allPhotos.filter((p) => {
    if (activeCat === null) return p.category_id === null && !p.shooting_id;
    if (activeShooting !== null) return p.shooting_id === activeShooting;
    return false; // в каталоге съёмок фото не показываем
  });

  const photoCountForShooting = (sid: number) => allPhotos.filter((p) => p.shooting_id === sid).length;

  const addFromBank = async (picked: PickedPhoto[]) => {
    if (picked.length === 0) return;
    const p = await portfolioAction(userId, 'add_photos', {
      photos: picked,
      category_id: activeCat,
      shooting_id: activeShooting,
    });
    onChange(p);
    toast({ title: 'Добавлено', description: `${picked.length} фото` });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let last: Portfolio | null = null;
    try {
      for (const file of Array.from(files)) {
        const b64 = await fileToBase64(file);
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        last = await portfolioAction(userId, 'upload_photo', {
          image_base64: b64,
          ext: ext === 'png' ? 'png' : 'jpg',
          category_id: activeCat,
          shooting_id: activeShooting,
        });
      }
      if (last) onChange(last);
      toast({ title: 'Загружено', description: `Добавлено фото: ${files.length}` });
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить фото', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const p = await portfolioAction(userId, 'add_category', { title: newCat.trim() });
    setNewCat('');
    onChange(p);
  };

  const deleteCategory = async (id: number) => {
    const p = await portfolioAction(userId, 'delete_category', { id });
    if (activeCat === id) { setActiveCat(null); setActiveShooting(null); }
    onChange(p);
  };

  const addShooting = async () => {
    if (!newShooting.trim() || activeCat === null) return;
    const p = await portfolioAction(userId, 'add_shooting', { title: newShooting.trim(), category_id: activeCat });
    setNewShooting('');
    onChange(p);
  };

  const deleteShooting = async (id: number) => {
    const p = await portfolioAction(userId, 'delete_shooting', { id });
    if (activeShooting === id) setActiveShooting(null);
    onChange(p);
  };

  const deletePhoto = async (id: number) => {
    const p = await portfolioAction(userId, 'delete_photo', { id });
    onChange(p);
  };

  const applyCover = async (url: string) => {
    if (!coverTarget) return;
    const action = coverTarget.kind === 'category' ? 'set_category_cover' : 'set_shooting_cover';
    const p = await portfolioAction(userId, action, { id: coverTarget.id, cover_url: url });
    onChange(p);
    setCoverTarget(null);
    toast({ title: 'Обложка обновлена' });
  };

  // Фото для окна выбора обложки
  const coverCandidates = coverTarget
    ? (coverTarget.kind === 'shooting'
        ? allPhotos.filter((p) => p.shooting_id === coverTarget.id)
        : [
            ...allPhotos.filter((p) => p.category_id === coverTarget.id),
            ...allPhotos.filter((p) => p.category_id !== coverTarget.id),
          ])
    : [];
  const currentCoverUrl = coverTarget
    ? (coverTarget.kind === 'category'
        ? categories.find((c) => c.id === coverTarget.id)?.cover_url
        : shootings.find((s) => s.id === coverTarget.id)?.cover_url)
    : '';

  const isCatalog = activeCat !== null && activeShooting === null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="Images" size={18} className="text-primary" />
        <span className="font-medium">Фотографии портфолио</span>
        <span className="text-xs text-muted-foreground">({allPhotos.length})</span>
      </div>

      {/* Вкладки категорий (уровень 1) */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setActiveCat(null); setActiveShooting(null); }}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition ${activeCat === null ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
          >
            <Icon name="Play" size={12} /> Фото для слайд-шоу
          </button>
          {categories.map((c) => (
            <span key={c.id} className={`group inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition ${activeCat === c.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <button onClick={() => { setActiveCat(c.id); setActiveShooting(null); }}>{c.title}</button>
              <button onClick={() => deleteCategory(c.id)} className="opacity-60 hover:opacity-100" title="Удалить категорию">
                <Icon name="X" size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="Новая категория (Свадьбы, Выпускные...)"
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addCategory}>
            <Icon name="Plus" size={14} />
          </Button>
        </div>
      </div>

      {/* ── СЛАЙД-ШОУ ── */}
      {activeCat === null && (
        <>
          <p className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
            Эти фото показываются <b>только в слайд-шоу</b> на главной обложке портфолио.
          </p>
          {renderAddButtons('Новые фото → в слайд-шоу')}
          {renderPhotoGrid()}
        </>
      )}

      {/* ── КАТАЛОГ СЪЁМОК категории ── */}
      {isCatalog && activeCategory && (
        <>
          <div className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeCategory.cover_url ? (
                <img src={activeCategory.cover_url} alt="" className="w-14 h-9 object-cover rounded shrink-0" />
              ) : (
                <div className="w-14 h-9 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Icon name="Image" size={14} className="text-muted-foreground" />
                </div>
              )}
              <span className="text-xs text-muted-foreground truncate">Обложка категории «{activeCategory.title}»</span>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setCoverTarget({ kind: 'category', id: activeCategory.id, title: activeCategory.title })} disabled={allPhotos.length === 0}>
              <Icon name="ImagePlus" size={14} className="mr-1" /> Обложка
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Icon name="FolderPlus" size={16} className="text-primary" />
            <span className="text-sm font-medium">Съёмки в «{activeCategory.title}»</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newShooting}
              onChange={(e) => setNewShooting(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addShooting()}
              placeholder="Название съёмки (Иван и Ксения...)"
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={addShooting}>
              <Icon name="Plus" size={14} className="mr-1" /> Добавить съёмку
            </Button>
          </div>

          {catShootings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {catShootings.map((s) => (
                <div key={s.id} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <button onClick={() => setActiveShooting(s.id)} className="block w-full text-left">
                    <div className="aspect-video bg-gray-100 dark:bg-gray-800">
                      {(s.cover_url || allPhotos.find((p) => p.shooting_id === s.id)) ? (
                        <img
                          src={s.cover_url || allPhotos.find((p) => p.shooting_id === s.id)?.grid_thumbnail_url || allPhotos.find((p) => p.shooting_id === s.id)?.photo_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="Camera" size={20} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground">{photoCountForShooting(s.id)} фото</div>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteShooting(s.id)}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 transition"
                    title="Удалить съёмку"
                  >
                    <Icon name="Trash2" size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl border-gray-300 dark:border-gray-700">
              Добавьте съёмки — каждая станет отдельной папкой с фото.
            </p>
          )}
        </>
      )}

      {/* ── ФОТО КОНКРЕТНОЙ СЪЁМКИ ── */}
      {activeShooting !== null && activeShootingObj && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setActiveShooting(null)} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Icon name="ArrowLeft" size={15} /> К съёмкам «{activeCategory?.title}»
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeShootingObj.cover_url ? (
                <img src={activeShootingObj.cover_url} alt="" className="w-14 h-9 object-cover rounded shrink-0" />
              ) : (
                <div className="w-14 h-9 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Icon name="Image" size={14} className="text-muted-foreground" />
                </div>
              )}
              <span className="text-xs text-muted-foreground truncate">Съёмка «{activeShootingObj.title}» · обложка</span>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setCoverTarget({ kind: 'shooting', id: activeShootingObj.id, title: activeShootingObj.title })} disabled={viewPhotos.length === 0}>
              <Icon name="ImagePlus" size={14} className="mr-1" /> Обложка
            </Button>
          </div>
          {renderAddButtons(`Новые фото → в съёмку «${activeShootingObj.title}»`)}
          {renderPhotoGrid()}
        </>
      )}

      {/* Модалка выбора обложки */}
      <Dialog open={!!coverTarget} onOpenChange={(o) => !o && setCoverTarget(null)}>
        <DialogContent className="max-w-lg w-[calc(100%-1rem)] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Обложка «{coverTarget?.title}»</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Выберите фото — оно станет обложкой на главной. Лучше горизонтальное.</p>
          {coverCandidates.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
              {coverCandidates.map((ph) => (
                <button
                  key={ph.id}
                  onClick={() => applyCover(ph.photo_url)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition ${currentCoverUrl === ph.photo_url ? 'border-primary ring-2 ring-primary/40' : 'border-transparent hover:border-primary/40'}`}
                >
                  <img src={ph.grid_thumbnail_url || ph.thumbnail_url || ph.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  {currentCoverUrl === ph.photo_url && (
                    <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                      <Icon name="Check" size={18} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Сначала добавьте фото.</p>
          )}
        </DialogContent>
      </Dialog>

      <PhotoBankPicker open={bankOpen} userId={userId} onClose={() => setBankOpen(false)} onPick={addFromBank} />
    </div>
  );

  function renderAddButtons(hint: string) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setBankOpen(true)}>
          <Icon name="FolderOpen" size={15} className="mr-1.5" /> Из фотобанка
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Icon name={uploading ? 'Loader2' : 'Upload'} size={15} className={`mr-1.5 ${uploading ? 'animate-spin' : ''}`} />
          {uploading ? 'Загрузка...' : 'С устройства'}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
        <span className="text-xs text-muted-foreground py-2">{hint}</span>
      </div>
    );
  }

  function renderPhotoGrid() {
    if (viewPhotos.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl border-gray-300 dark:border-gray-700">
          Пока нет фото. Добавьте из фотобанка или с устройства.
        </p>
      );
    }
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {viewPhotos.map((ph) => (
          <div key={ph.id} className="relative aspect-square rounded-lg overflow-hidden group">
            <img src={ph.grid_thumbnail_url || ph.thumbnail_url || ph.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-start justify-end p-1">
              <button
                onClick={() => deletePhoto(ph.id)}
                className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 transition"
                title="Удалить"
              >
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }
};

export default PortfolioPhotosManager;