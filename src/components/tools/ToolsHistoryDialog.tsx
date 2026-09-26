import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import { PHOTOBANK_URL, urlToImage } from '@/components/tools/logoRemover/utils';
import {
  ToolHistoryItem,
  TOOL_LABELS,
  HISTORY_EVENT,
  listHistory,
  removeFromHistory,
  clearHistory,
} from '@/lib/toolsHistory';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const fileNameFor = (item: ToolHistoryItem, ext: string) => `${item.tool}-${item.createdAt}.${ext}`;

const ToolsHistoryDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [items, setItems] = useState<ToolHistoryItem[]>([]);
  const [preview, setPreview] = useState<ToolHistoryItem | null>(null);
  const [saveItem, setSaveItem] = useState<ToolHistoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    listHistory().then(setItems);
  }, []);

  useEffect(() => {
    if (open) reload();
    window.addEventListener(HISTORY_EVENT, reload);
    return () => window.removeEventListener(HISTORY_EVENT, reload);
  }, [open, reload]);

  const download = (item: ToolHistoryItem) => {
    const a = document.createElement('a');
    if (item.image) {
      a.href = item.image;
      a.download = fileNameFor(item, 'jpg');
    } else {
      a.href = URL.createObjectURL(new Blob([item.text || ''], { type: 'text/plain;charset=utf-8' }));
      a.download = fileNameFor(item, 'txt');
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyText = async (item: ToolHistoryItem) => {
    await navigator.clipboard.writeText(item.text || '');
    toast({ title: 'Текст скопирован' });
  };

  const remove = async (item: ToolHistoryItem) => {
    await removeFromHistory(item.id);
    if (preview?.id === item.id) setPreview(null);
  };

  const handleClear = async () => {
    if (!confirm('Удалить всю историю результатов?')) return;
    await clearHistory();
  };

  const handleSaveToFolder = async (folder: { id: number; folder_name: string }) => {
    const userId = getAuthUserId();
    if (!userId || !saveItem?.image) return;
    try {
      setSaving(true);
      const img = await urlToImage(saveItem.image);
      const res = await fetch(PHOTOBANK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
        body: JSON.stringify({
          action: 'upload_direct',
          folder_id: folder.id,
          file_name: fileNameFor(saveItem, 'jpg'),
          file_data: saveItem.image,
          width: img.naturalWidth,
          height: img.naturalHeight,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast({ title: 'Сохранено', description: `Фото загружено в «${folder.folder_name}»` });
      setSaveItem(null);
    } catch (e) {
      toast({ title: 'Не удалось сохранить', description: String((e as Error)?.message || e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="History" size={22} className="text-primary" />
            История результатов
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Все готовые результаты инструментов сохраняются здесь автоматически (последние 60, в этом браузере)
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setPreview(null)}>
              <Icon name="ArrowLeft" size={16} />
              Назад к списку
            </Button>
            {preview.image ? (
              <img src={preview.image} alt="" className="max-h-[65vh] w-auto mx-auto rounded-lg border" />
            ) : (
              <div className="whitespace-pre-wrap text-sm rounded-lg border p-3 max-h-[60vh] overflow-y-auto">{preview.text}</div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => download(preview)}>
                <Icon name="Download" size={16} />
                Скачать
              </Button>
              {preview.image ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSaveItem(preview)}>
                  <Icon name="Save" size={16} />
                  В фотобанк
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyText(preview)}>
                  <Icon name="Copy" size={16} />
                  Копировать
                </Button>
              )}
              <Button size="sm" variant="ghost" className="gap-1.5 ml-auto text-destructive" onClick={() => remove(preview)}>
                <Icon name="Trash2" size={16} />
                Удалить
              </Button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Icon name="History" size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Пока пусто. Результаты появятся здесь после обработки.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((item) => (
                <div key={item.id} className="group rounded-lg border overflow-hidden bg-card flex flex-col">
                  <button type="button" onClick={() => setPreview(item)} className="aspect-square bg-muted overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : (
                      <div className="p-2 text-[11px] text-left text-muted-foreground line-clamp-[10] h-full">{item.text}</div>
                    )}
                  </button>
                  <div className="p-2 flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{TOOL_LABELS[item.tool]}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(item.createdAt)}</p>
                    </div>
                    <button type="button" title="Скачать" onClick={() => download(item)} className="p-1.5 rounded hover:bg-muted">
                      <Icon name="Download" size={14} />
                    </button>
                    <button type="button" title="Удалить" onClick={() => remove(item)} className="p-1.5 rounded hover:bg-muted text-destructive">
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={handleClear}>
                <Icon name="Trash2" size={16} />
                Очистить историю
              </Button>
            </div>
          </>
        )}
      </DialogContent>

      <PhotoBankPicker
        open={!!saveItem}
        onOpenChange={(v) => !v && setSaveItem(null)}
        mode="save"
        onSave={handleSaveToFolder}
        saveDisabled={saving}
      />
    </Dialog>
  );
};

export default ToolsHistoryDialog;
