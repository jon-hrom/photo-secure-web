import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
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

const SliderPhotosManager = ({ userId, portfolio, onChange }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const photos = portfolio.slider_photos || [];

  const addFromBank = async (picked: PickedPhoto[]) => {
    if (picked.length === 0) return;
    const p = await portfolioAction(userId, 'add_slider_photos', { photos: picked });
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
        last = await portfolioAction(userId, 'upload_slider_photo', {
          image_base64: b64,
          ext: ext === 'png' ? 'png' : 'jpg',
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

  const deletePhoto = async (id: number) => {
    const p = await portfolioAction(userId, 'delete_slider_photo', { id });
    onChange(p);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="Smartphone" size={18} className="text-primary" />
        <span className="font-medium">Вертикальные фото для мобильного слайдера</span>
        <span className="text-xs text-muted-foreground">({photos.length})</span>
      </div>
      <p className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
        Эти вертикальные (портретные) фото показываются в слайдере <b>только на телефонах</b>,
        чтобы обложка красиво заполняла узкий экран. Если их нет — используются обычные фото слайд-шоу.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setBankOpen(true)}>
          <Icon name="FolderOpen" size={15} className="mr-1.5" /> Из фотобанка
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Icon name={uploading ? 'Loader2' : 'Upload'} size={15} className={`mr-1.5 ${uploading ? 'animate-spin' : ''}`} />
          {uploading ? 'Загрузка...' : 'С устройства'}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl border-gray-300 dark:border-gray-700">
          Пока нет вертикальных фото. Добавьте портретные снимки для мобильного слайдера.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photos.map((ph) => (
            <div key={ph.id} className="relative aspect-[3/4] rounded-lg overflow-hidden group bg-gray-100 dark:bg-gray-800">
              <img
                src={ph.grid_thumbnail_url || ph.thumbnail_url || ph.photo_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <button
                onClick={() => deletePhoto(ph.id)}
                className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                title="Удалить"
              >
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <PhotoBankPicker open={bankOpen} userId={userId} onClose={() => setBankOpen(false)} onPick={addFromBank} />
    </div>
  );
};

export default SliderPhotosManager;
