import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { BatchItem, Photo } from '@/components/photobank/skinRetouchDialog/shared';

interface BatchRetouchTabProps {
  items: BatchItem[];
  setItems: Dispatch<SetStateAction<BatchItem[]>>;
  retouchable: Photo[];
  skippedCount: number;
  price: number | null;
  batchRunning: boolean;
  cancelRef: MutableRefObject<boolean>;
  doneCount: number;
  failedIds: number[];
  finishedCount: number;
  runBatch: (only?: number[]) => void;
}

const BatchRetouchTab = ({
  items,
  setItems,
  retouchable,
  skippedCount,
  price,
  batchRunning,
  cancelRef,
  doneCount,
  failedIds,
  finishedCount,
  runBatch,
}: BatchRetouchTabProps) => (
  <>
    {items.length === 0 ? (
      <div className="rounded-lg border border-border p-4 space-y-2">
        <p className="text-sm">
          Будет обработано <b>{retouchable.length}</b> фото
          {price !== null && (
            <>
              {' '}— примерно <b>{retouchable.length * price} ⚡</b>
            </>
          )}
        </p>
        {skippedCount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Пропущено {skippedCount} (видео не ретушируются)
          </p>
        )}
        <Button onClick={() => runBatch()} className="w-full gap-2">
          <Icon name="Sparkles" size={16} />
          Отретушировать всю папку
        </Button>
      </div>
    ) : (
      <>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span>
              Готово {doneCount} из {items.length}
              {failedIds.length > 0 && <span className="text-destructive"> · ошибок {failedIds.length}</span>}
            </span>
            <span className="text-muted-foreground">{Math.round((finishedCount / items.length) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(finishedCount / items.length) * 100}%` }} />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-lg border border-border p-1.5">
              {it.thumb ? (
                <img src={it.thumb} alt="" className="w-10 h-10 rounded object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="w-10 h-10 rounded bg-muted shrink-0 flex items-center justify-center text-[9px] font-semibold text-muted-foreground">RAW</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{it.file_name}</p>
                <p className={`text-[11px] truncate ${it.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {it.status === 'pending' ? 'В очереди' : it.text}
                </p>
              </div>
              {it.status === 'processing' && <Icon name="Loader2" size={16} className="animate-spin text-primary shrink-0" />}
              {it.status === 'done' && <Icon name="CheckCircle2" size={16} className="text-green-600 shrink-0" />}
              {it.status === 'failed' && <Icon name="XCircle" size={16} className="text-destructive shrink-0" />}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {batchRunning ? (
            <Button variant="outline" onClick={() => { cancelRef.current = true; }} className="gap-1.5">
              <Icon name="Square" size={14} />
              Остановить
            </Button>
          ) : (
            <>
              {failedIds.length > 0 && (
                <Button variant="outline" onClick={() => runBatch(failedIds)} className="gap-1.5">
                  <Icon name="RefreshCw" size={14} />
                  Повторить ошибки ({failedIds.length})
                </Button>
              )}
              <Button variant="ghost" onClick={() => setItems([])} className="gap-1.5 ml-auto">
                <Icon name="Plus" size={14} />
                Новая обработка
              </Button>
            </>
          )}
        </div>
      </>
    )}
  </>
);

export default BatchRetouchTab;
