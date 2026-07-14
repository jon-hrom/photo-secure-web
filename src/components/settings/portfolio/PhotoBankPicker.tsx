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
      <DialogContent className="max-w-[min(92vw,1100px)] w-[calc(100%-1rem)] h-[90vh] sm:h-[85vh] flex flex-col rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            {activeFolder && (
              <button onClick={() => setActiveFolder(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded shrink-0">
                <Icon name="ArrowLeft" size={18} />
              </button>
            )}
            <span className="truncate">{activeFolder ? activeFolder.folder_name : 'Фотобанк — выберите папку'}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : !activeFolder ? (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => openFolder(f)}
                  className="flex flex-col items-start gap-1 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 transition text-left"
                >
                  <Icon name="Folder" size={24} className="text-primary" />
                  <span className="text-sm font-medium truncate w-full mt-1">{f.folder_name}</span>
                  <span className="text-xs text-muted-foreground">{f.photo_count} фото</span>
                </button>
              ))}
              {folders.length === 0 && (
                <p className="col-span-full text-center text-sm text-muted-foreground py-8">Нет папок с фото</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <span className="text-xs sm:text-sm text-muted-foreground">
                {photos.length} фото · выделите нужные
              </span>
              <button
                onClick={() => setSelected(selected.size === photos.length ? new Set() : new Set(photos.map((p) => p.id)))}
                className="text-xs sm:text-sm text-primary hover:underline"
              >
                {selected.size === photos.length ? 'Снять всё' : 'Выбрать все'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3">
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all select-none ${
                      selected.has(p.id) ? 'border-primary ring-2 ring-primary/40' : 'border-transparent hover:border-primary/40'
                    }`}
                  >
                    <img
                      src={p.grid_thumbnail_s3_url || p.thumbnail_s3_url || p.s3_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                    {selected.has(p.id) && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Icon name="Check" size={15} className="text-white" />
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <span className="text-sm text-muted-foreground">Выбрано: {selected.size}</span>
              <Button onClick={confirm} disabled={selected.size === 0} className="shrink-0">
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