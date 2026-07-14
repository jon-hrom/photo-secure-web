import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Portfolio, PortfolioCategory, portfolioAction } from '@/lib/portfolioApi';
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

const PortfolioPhotosManager = ({ userId, portfolio, onChange }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newCat, setNewCat] = useState('');
  // activeCat: null = «Фото для слайд-шоу» (фото без категории)
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [coverForCat, setCoverForCat] = useState<PortfolioCategory | null>(null);
  const [bankOpen, setBankOpen] = useState(false);

  const addFromBank = async (picked: PickedPhoto[]) => {
    if (picked.length === 0) return;
    const p = await portfolioAction(userId, 'add_photos', { photos: picked, category_id: activeCat });
    onChange(p);
    toast({ title: 'Добавлено', description: `${picked.length} фото` });
  };

  const categories = portfolio.categories || [];
  const allPhotos = portfolio.photos || [];
  const photos = allPhotos.filter((p) =>
    activeCat === null ? p.category_id === null : p.category_id === activeCat
  );

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
    if (activeCat === id) setActiveCat(null);
    onChange(p);
  };

  const deletePhoto = async (id: number) => {
    const p = await portfolioAction(userId, 'delete_photo', { id });
    onChange(p);
  };

  const setPhotoCategory = async (id: number, categoryId: number | null) => {
    const p = await portfolioAction(userId, 'set_photo_category', { id, category_id: categoryId });
    onChange(p);
  };

  const setCategoryCover = async (catId: number, coverUrl: string) => {
    const p = await portfolioAction(userId, 'set_category_cover', { id: catId, cover_url: coverUrl });
    onChange(p);
    setCoverForCat(null);
    toast({ title: 'Обложка обновлена' });
  };

  const activeCategory = categories.find((c) => c.id === activeCat) || null;
  // Для обложки: сначала фото самой категории, затем остальные (можно выбрать любое)
  const coverCatPhotos = coverForCat
    ? [
        ...allPhotos.filter((p) => p.category_id === coverForCat.id),
        ...allPhotos.filter((p) => p.category_id !== coverForCat.id),
      ]
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="Images" size={18} className="text-primary" />
        <span className="font-medium">Фотографии портфолио</span>
        <span className="text-xs text-muted-foreground">({allPhotos.length})</span>
      </div>

      {/* Вкладки: слайд-шоу + категории */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCat(null)}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition ${activeCat === null ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
          >
            <Icon name="Play" size={12} /> Фото для слайд-шоу
          </button>
          {categories.map((c) => (
            <span key={c.id} className={`group inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition ${activeCat === c.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <button onClick={() => setActiveCat(c.id)}>{c.title}</button>
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

      {/* Пояснение + обложка категории */}
      {activeCat === null ? (
        <p className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
          Эти фото показываются <b>только в слайд-шоу</b> на главной обложке портфолио. В папках категорий их не видно.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {activeCategory?.cover_url ? (
              <img src={activeCategory.cover_url} alt="" className="w-14 h-9 object-cover rounded shrink-0" />
            ) : (
              <div className="w-14 h-9 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <Icon name="Image" size={14} className="text-muted-foreground" />
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate">
              Обложка папки «{activeCategory?.title}» (горизонтальная)
            </span>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => activeCategory && setCoverForCat(activeCategory)} disabled={allPhotos.length === 0}>
            <Icon name="ImagePlus" size={14} className="mr-1" /> Обложка
          </Button>
        </div>
      )}

      {/* Кнопки добавления */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setBankOpen(true)}>
          <Icon name="FolderOpen" size={15} className="mr-1.5" /> Из фотобанка
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Icon name={uploading ? 'Loader2' : 'Upload'} size={15} className={`mr-1.5 ${uploading ? 'animate-spin' : ''}`} />
          {uploading ? 'Загрузка...' : 'С устройства'}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
        <span className="text-xs text-muted-foreground py-2">
          {activeCat === null ? 'Новые фото → в слайд-шоу' : `Новые фото → в «${activeCategory?.title}»`}
        </span>
      </div>

      {/* Сетка фото */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {photos.map((ph) => (
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
              <select
                value={ph.category_id ?? ''}
                onChange={(e) => setPhotoCategory(ph.id, e.target.value ? Number(e.target.value) : null)}
                className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white px-1 py-0.5 opacity-0 group-hover:opacity-100 transition"
              >
                <option value="">Для слайд-шоу</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl border-gray-300 dark:border-gray-700">
          {activeCat === null
            ? 'Пока нет фото для слайд-шоу. Добавьте из фотобанка или с устройства.'
            : 'В этой категории пока нет фото. Добавьте их, и не забудьте назначить обложку.'}
        </p>
      )}

      {/* Модалка выбора обложки категории */}
      <Dialog open={!!coverForCat} onOpenChange={(o) => !o && setCoverForCat(null)}>
        <DialogContent className="max-w-lg w-[calc(100%-1rem)] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Обложка папки «{coverForCat?.title}»</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Выберите любое фото — оно станет обложкой категории на главной. Лучше горизонтальное.</p>
          {coverCatPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
              {coverCatPhotos.map((ph) => (
                <button
                  key={ph.id}
                  onClick={() => coverForCat && setCategoryCover(coverForCat.id, ph.photo_url)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition ${coverForCat?.cover_url === ph.photo_url ? 'border-primary ring-2 ring-primary/40' : 'border-transparent hover:border-primary/40'}`}
                >
                  <img src={ph.grid_thumbnail_url || ph.thumbnail_url || ph.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  {coverForCat?.cover_url === ph.photo_url && (
                    <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                      <Icon name="Check" size={18} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Сначала добавьте фото в эту категорию.</p>
          )}
        </DialogContent>
      </Dialog>

      <PhotoBankPicker open={bankOpen} userId={userId} onClose={() => setBankOpen(false)} onPick={addFromBank} />
    </div>
  );
};

export default PortfolioPhotosManager;