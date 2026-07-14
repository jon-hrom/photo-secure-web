import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';

interface Folder {
  id: number;
  folder_name: string;
  photo_count: number;
}

interface BankPhoto {
  id: number;
  s3_url?: string;
  thumbnail_s3_url?: string;
  grid_thumbnail_s3_url?: string;
}

export interface PickedPhoto {
  photo_url: string;
  thumbnail_url: string;
  grid_thumbnail_url: string;
  source: string;
}

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
  onPick: (photos: PickedPhoto[]) => void;
}

const PhotoBankPicker = ({ open, userId, onClose, onPick }: Props) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [photos, setPhotos] = useState<BankPhoto[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveFolder(null);
    setSelected(new Set());
    setLoading(true);
    fetch(`${FOLDERS_API}?action=list`, { headers: { 'X-User-Id': userId } })
      .then((r) => r.json())
      .then((d) => setFolders((d.folders || []).filter((f: Folder) => f.photo_count > 0)))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const openFolder = (f: Folder) => {
    setActiveFolder(f);
    setSelected(new Set());
    setLoading(true);
    fetch(`${FOLDERS_API}?action=list_photos&folder_id=${f.id}`, { headers: { 'X-User-Id': userId } })
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos || []))
      .finally(() => setLoading(false));
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    const picked: PickedPhoto[] = photos
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        photo_url: p.s3_url || p.thumbnail_s3_url || '',
        thumbnail_url: p.thumbnail_s3_url || p.s3_url || '',
        grid_thumbnail_url: p.grid_thumbnail_s3_url || p.thumbnail_s3_url || p.s3_url || '',
        source: 'photobank',
      }))
      .filter((p) => p.photo_url);
    onPick(picked);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[calc(100%-1rem)] rounded-2xl p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {activeFolder && (
              <button onClick={() => setActiveFolder(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <Icon name="ArrowLeft" size={18} />
              </button>
            )}
            {activeFolder ? activeFolder.folder_name : 'Фотобанк — выберите папку'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : !activeFolder ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => openFolder(f)}
                className="flex flex-col items-start gap-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary transition text-left"
              >
                <Icon name="Folder" size={22} className="text-primary" />
                <span className="text-sm font-medium truncate w-full">{f.folder_name}</span>
                <span className="text-xs text-muted-foreground">{f.photo_count} фото</span>
              </button>
            ))}
            {folders.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">Нет папок с фото</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto">
              {photos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selected.has(p.id) ? 'border-primary ring-2 ring-primary/40' : 'border-transparent'
                  }`}
                >
                  <img
                    src={p.grid_thumbnail_s3_url || p.thumbnail_s3_url || p.s3_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selected.has(p.id) && (
                    <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                      <Icon name="Check" size={20} className="text-white drop-shadow" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm text-muted-foreground">Выбрано: {selected.size}</span>
              <Button onClick={confirm} disabled={selected.size === 0}>
                Добавить в портфолио
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoBankPicker;