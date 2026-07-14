import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { Portfolio, portfolioAction } from '@/lib/portfolioApi';

interface Props {
  userId: string;
  portfolio: Portfolio;
  onChange: (p: Portfolio) => void;
  onOpenBank: () => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const PortfolioPhotosManager = ({ userId, portfolio, onChange, onOpenBank }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [activeCat, setActiveCat] = useState<number | null>(null);

  const categories = portfolio.categories || [];
  const photos = (portfolio.photos || []).filter(
    (p) => activeCat === null || p.category_id === activeCat
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="Images" size={18} className="text-primary" />
        <span className="font-medium">Фотографии портфолио</span>
        <span className="text-xs text-muted-foreground">({portfolio.photos?.length || 0})</span>
      </div>

      {/* Категории съёмок */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCat(null)}
            className={`text-xs px-2.5 py-1 rounded-full transition ${activeCat === null ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
          >
            Все
          </button>
          {categories.map((c) => (
            <span key={c.id} className={`group inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition ${activeCat === c.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <button onClick={() => setActiveCat(c.id)}>{c.title}</button>
              <button onClick={() => deleteCategory(c.id)} className="opacity-60 hover:opacity-100">
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

      {/* Кнопки добавления */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onOpenBank}>
          <Icon name="FolderOpen" size={15} className="mr-1.5" /> Из фотобанка
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Icon name={uploading ? 'Loader2' : 'Upload'} size={15} className={`mr-1.5 ${uploading ? 'animate-spin' : ''}`} />
          {uploading ? 'Загрузка...' : 'С устройства'}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
        {activeCat !== null && (
          <span className="text-xs text-muted-foreground py-2">Новые фото попадут в «{categories.find((c) => c.id === activeCat)?.title}»</span>
        )}
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
              {categories.length > 0 && (
                <select
                  value={ph.category_id ?? ''}
                  onChange={(e) => setPhotoCategory(ph.id, e.target.value ? Number(e.target.value) : null)}
                  className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white px-1 py-0.5 opacity-0 group-hover:opacity-100 transition"
                >
                  <option value="">Без категории</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl border-gray-300 dark:border-gray-700">
          Пока нет фото. Добавьте из фотобанка или с устройства.
        </p>
      )}
    </div>
  );
};

export default PortfolioPhotosManager;
