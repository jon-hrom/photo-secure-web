import { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import CompareView from '@/components/tools/skinRetouch/CompareView';
import { Photo, isRaw, thumbOf } from '@/components/photobank/skinRetouchDialog/shared';

interface SingleRetouchTabProps {
  busy: boolean;
  retouchable: Photo[];
  selectedId: number | null;
  setSelectedId: Dispatch<SetStateAction<number | null>>;
  singleBusy: boolean;
  singleText: string;
  singleOriginal: string;
  singleResult: string;
  setSingleResult: Dispatch<SetStateAction<string>>;
  compare: number;
  setCompare: Dispatch<SetStateAction<number>>;
  price: number | null;
  runSingle: () => void;
}

const SingleRetouchTab = ({
  busy,
  retouchable,
  selectedId,
  setSelectedId,
  singleBusy,
  singleText,
  singleOriginal,
  singleResult,
  setSingleResult,
  compare,
  setCompare,
  price,
  runSingle,
}: SingleRetouchTabProps) => (
  <>
    {singleResult ? (
      <>
        <CompareView originalUrl={singleOriginal} resultUrl={singleResult} compare={compare} setCompare={setCompare} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSingleResult('')}>
          <Icon name="RotateCcw" size={16} />
          Другое фото
        </Button>
      </>
    ) : (
      <>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 max-h-64 overflow-y-auto">
          {retouchable.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => setSelectedId(p.id)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                selectedId === p.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/30'
              }`}
            >
              {thumbOf(p) ? (
                <img src={thumbOf(p)} alt={p.file_name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  <span className="text-[10px]">RAW → JPG</span>
                </div>
              )}
              {isRaw(p) && (
                <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">RAW</span>
              )}
              {selectedId === p.id && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Icon name="Check" size={22} className="text-white drop-shadow-lg" />
                </div>
              )}
            </button>
          ))}
        </div>
        {singleBusy ? (
          <div className="rounded-lg border border-border p-3 flex items-center gap-3">
            <Icon name="Loader2" size={20} className="animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">{singleText || 'Обработка...'}</p>
              <p className="text-[11px] text-muted-foreground">Обычно 20–60 секунд</p>
            </div>
          </div>
        ) : (
          <Button onClick={runSingle} disabled={!selectedId} className="w-full sm:w-auto gap-2">
            <Icon name="Sparkles" size={16} />
            Отретушировать{price !== null ? ` · ${price} ⚡` : ''}
          </Button>
        )}
      </>
    )}
  </>
);

export default SingleRetouchTab;
