import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';

const PHOTOBANK_URL = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';

interface Folder {
  id: number;
  folder_name: string;
  photo_count: number;
  folder_type?: string;
  parent_folder_id?: number | null;
}

interface PhotoItem {
  id: number;
  file_name: string;
  s3_url: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  is_video?: boolean;
}

interface PhotoBankPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'pick' | 'save';
  onPick?: (photo: PhotoItem) => void;
  onSave?: (folder: Folder) => void;
  saveDisabled?: boolean;
}

const PhotoBankPicker = ({ open, onOpenChange, mode, onPick, onSave, saveDisabled }: PhotoBankPickerProps) => {
  const { toast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const loadFolders = useCallback(async () => {
    const userId = getAuthUserId();
    if (!userId) {
      toast({ title: 'Не удалось определить пользователя', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${PHOTOBANK_URL}?action=list`, {
        headers: { 'X-User-Id': userId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const list: Folder[] = (data.folders || []).filter((f: Folder) => f.folder_type !== 'tech_rejects');
      setFolders(list);
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка загрузки папок', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadPhotos = useCallback(async (folder: Folder) => {
    const userId = getAuthUserId();
    if (!userId) return;
    try {
      setLoading(true);
      const res = await fetch(`${PHOTOBANK_URL}?action=list_photos&folder_id=${folder.id}`, {
        headers: { 'X-User-Id': userId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const list: PhotoItem[] = (data.photos || []).filter((p: PhotoItem) => !p.is_raw && !p.is_video);
      setPhotos(list);
      setCurrentFolder(folder);
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка загрузки фото', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      setCurrentFolder(null);
      setPhotos([]);
      loadFolders();
    }
  }, [open, loadFolders]);

  const title = mode === 'pick' ? 'Выбрать фото из фотобанка' : 'Сохранить в фотобанк';
  const desc = mode === 'pick'
    ? (currentFolder ? `Папка: ${currentFolder.folder_name}` : 'Выберите папку')
    : 'Выберите папку, куда сохранить результат';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name={mode === 'pick' ? 'FolderOpen' : 'Save'} size={20} className="text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{desc}</DialogDescription>
        </DialogHeader>

        {mode === 'pick' && currentFolder && (
          <div className="flex items-center gap-2 -mt-2">
            <Button variant="ghost" size="sm" onClick={() => { setCurrentFolder(null); setPhotos([]); }} className="gap-1">
              <Icon name="ChevronLeft" size={16} /> К папкам
            </Button>
          </div>
        )}

        {loading && (
          <div className="py-10 flex items-center justify-center">
            <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && mode === 'save' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-2">
            {folders.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">Нет папок в фотобанке</p>
            )}
            {folders.map((f) => (
              <button
                key={f.id}
                disabled={saveDisabled}
                onClick={() => onSave?.(f)}
                className="group relative rounded-xl border border-border bg-card hover:shadow-md hover:scale-[1.02] transition-all p-3 sm:p-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shadow-md flex-shrink-0">
                    <Icon name="Folder" size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{f.folder_name}</p>
                    <p className="text-[11px] text-muted-foreground">{f.photo_count || 0} фото</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && mode === 'pick' && !currentFolder && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-2">
            {folders.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">Нет папок в фотобанке</p>
            )}
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => loadPhotos(f)}
                className="group relative rounded-xl border border-border bg-card hover:shadow-md hover:scale-[1.02] transition-all p-3 sm:p-4 text-left"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shadow-md flex-shrink-0">
                    <Icon name="Folder" size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{f.folder_name}</p>
                    <p className="text-[11px] text-muted-foreground">{f.photo_count || 0} фото</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && mode === 'pick' && currentFolder && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-2">
            {photos.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">В папке нет фото</p>
            )}
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick?.(p)}
                className="relative aspect-square rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all bg-muted"
                title={p.file_name}
              >
                <img
                  src={p.thumbnail_s3_url || p.s3_url}
                  alt={p.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoBankPicker;
