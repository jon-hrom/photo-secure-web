import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import UploadStage from '@/components/tools/logoRemover/UploadStage';
import CompareView from '@/components/tools/skinRetouch/CompareView';
import { useUpscaleApi, UpscaleSize } from '@/components/tools/upscale/useUpscaleApi';
import { targetSize } from '@/components/tools/upscale/composeUpscale';

interface UpscaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SIZES: { id: UpscaleSize; label: string }[] = [
  { id: 'orig', label: 'Оригинал' },
  { id: '2k', label: '2K' },
  { id: '4k', label: '4K' },
  { id: '8k', label: '8K' },
];

const UpscaleDialog = ({ open, onOpenChange }: UpscaleDialogProps) => {
  const s = useUpscaleApi(open);
  const src = s.source?.img;
  const ow = src?.naturalWidth || 0;
  const oh = src?.naturalHeight || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-[98vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Maximize" size={22} className="text-primary" />
            Увеличить разрешение
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Фото остаётся тем же самым — меняется только размер: 2K, 4K или 8K. AI добавляет лишь чёткость мелких деталей
          </DialogDescription>
        </DialogHeader>

        {s.stage === 'upload' && (
          <UploadStage
            fileInputRef={s.fileInputRef}
            onFile={s.handleFile}
            onOpenPicker={() => s.setShowPicker(true)}
          />
        )}

        {s.stage === 'edit' && (
          <div className="mt-3 space-y-3">
            <div className="relative">
              {s.resultUrl && s.originalUrl ? (
                <CompareView originalUrl={s.originalUrl} resultUrl={s.resultUrl} compare={s.compare} setCompare={s.setCompare} />
              ) : (
                <div className="rounded-xl overflow-hidden border border-border bg-black/5 flex items-center justify-center" style={{ minHeight: 240 }}>
                  {s.originalUrl && (
                    <img src={s.originalUrl} alt="Исходное фото" className="block max-w-full h-auto" style={{ maxHeight: '60vh', objectFit: 'contain' }} />
                  )}
                </div>
              )}
              {s.loading && (
                <div className="absolute inset-0 rounded-xl bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm z-40">
                  <Icon name="Loader2" size={36} className="animate-spin mb-2" />
                  <p className="text-sm px-4 text-center">{s.loadingText || 'Обработка...'}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium">Разрешение фото</p>
                {ow > 0 && <p className="text-xs text-muted-foreground">Сейчас: {ow}×{oh}</p>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SIZES.map((opt) => {
                  const t = ow ? targetSize(ow, oh, opt.id) : null;
                  const tooSmall = opt.id !== 'orig' && !!t && t.width <= ow;
                  const active = s.size === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={s.loading || tooSmall}
                      onClick={() => s.setSize(opt.id)}
                      className={`rounded-lg border px-2 py-2.5 text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        active ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className={`${opt.id === 'orig' ? 'text-sm' : 'text-base'} font-bold ${active ? 'text-primary' : ''}`}>{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground">{t ? `${t.width}×${t.height}` : '—'}</div>
                      {s.prices && (
                        <div className="text-[11px] font-medium text-yellow-600 dark:text-yellow-500">{s.prices[opt.id]} ⚡</div>
                      )}
                    </button>
                  );
                })}
              </div>
              {s.size === 'orig' && (
                <p className="text-[11px] text-muted-foreground">
                  Размер фото не меняется — только стабилизация: чёткие контуры и глаза, без двоения.
                </p>
              )}
              {s.size === '8k' && (
                <p className="text-[11px] text-muted-foreground">
                  8K — очень большой файл (до 60 МБ). На слабом телефоне сборка может занять до минуты.
                </p>
              )}
            </div>

            <label className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Icon name="Crosshair" size={15} className="text-primary" />
                  Стабилизация изображения
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Точно совмещает детали по всему кадру — без двоения контуров. Итог резкий и без искажений.
                </p>
              </div>
              <Switch checked={s.stabilize || s.size === 'orig'} onCheckedChange={s.setStabilize} disabled={s.loading || s.size === 'orig'} className="mt-0.5 shrink-0" />
            </label>

            {s.resultInfo && (
              <div className="flex items-center gap-2 text-sm rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-2">
                <Icon name="CircleCheck" size={16} />
                Готово: {s.resultInfo.width}×{s.resultInfo.height} ({s.resultInfo.size === 'orig' ? 'стабилизация' : s.resultInfo.size.toUpperCase()}). Двигайте шторку, чтобы сравнить.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={s.upscale} disabled={s.loading} size="sm" className="gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90">
                <Icon name="Sparkles" size={16} />
                {s.size === 'orig'
                  ? (s.resultInfo ? 'Стабилизировать заново' : 'Стабилизировать')
                  : (s.resultInfo ? 'Увеличить заново' : `Увеличить до ${s.size.toUpperCase()}`)}
              </Button>
              <Button onClick={s.download} disabled={s.loading || !s.resultInfo} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Download" size={16} />
                Скачать
              </Button>
              <Button onClick={() => s.setShowSaver(true)} disabled={s.loading || !s.resultInfo} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Save" size={16} />
                В фотобанк
              </Button>
              <Button onClick={s.resetAll} disabled={s.loading} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                <Icon name="ImagePlus" size={16} />
                Другое фото
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <PhotoBankPicker open={s.showPicker} onOpenChange={s.setShowPicker} mode="pick" onPick={s.handlePickFromBank} />
      <PhotoBankPicker open={s.showSaver} onOpenChange={s.setShowSaver} mode="save" onSave={s.handleSaveToFolder} saveDisabled={s.saving} />
    </Dialog>
  );
};

export default UpscaleDialog;
