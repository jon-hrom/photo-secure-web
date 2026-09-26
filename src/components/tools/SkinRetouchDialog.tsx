import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import UploadStage from '@/components/tools/skinRetouch/UploadStage';
import CompareView from '@/components/tools/skinRetouch/CompareView';
import { useRetouchApi } from '@/components/tools/skinRetouch/useRetouchApi';
import { PRESETS, EYE_SHARPEN_OPTIONS } from '@/components/tools/skinRetouch/utils';

interface SkinRetouchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SkinRetouchDialog = ({ open, onOpenChange }: SkinRetouchDialogProps) => {
  const s = useRetouchApi(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-[98vw] sm:max-w-3xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Sparkles" size={22} className="text-primary" />
            Ретушь фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            AI выровняет кожу и уберёт акне, не меняя черты лица и фигуру
          </DialogDescription>
        </DialogHeader>

        {s.stage === 'upload' && (
          <UploadStage
            fileInputRef={s.fileInputRef}
            preset={s.preset}
            setPreset={s.setPreset}
            eyeSharpen={s.eyeSharpen}
            setEyeSharpen={s.setEyeSharpen}
            price={s.price}
            onFile={s.handleFile}
            onOpenPicker={() => s.setShowPicker(true)}
          />
        )}

        {s.stage === 'result' && s.resultUrl && (
          <div className="mt-3 space-y-3">
            <CompareView
              originalUrl={s.originalUrl}
              resultUrl={s.resultUrl}
              compare={s.compare}
              setCompare={s.setCompare}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={s.download} disabled={s.loading} size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
                <Icon name="Download" size={16} />
                Скачать
              </Button>
              <Button onClick={() => s.setShowSaver(true)} disabled={s.loading || s.saving} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Save" size={16} />
                В фотобанк
              </Button>
              <Button onClick={s.reset} disabled={s.loading} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                <Icon name="RotateCcw" size={16} />
                Новое фото
              </Button>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-2">
                Не тот результат? Пересчитать с другой силой — новое списание
                {s.price !== null ? ` ${s.price} ⚡` : ''}
              </p>
              <div className="flex items-center gap-1.5 mb-2 text-[11px]">
                <span className="text-muted-foreground">Резкость глаз:</span>
                {EYE_SHARPEN_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    disabled={s.loading}
                    onClick={() => s.setEyeSharpen(o.key)}
                    className={`rounded-md border px-2 py-0.5 transition-colors ${
                      s.eyeSharpen === o.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    variant={s.preset === p.key ? 'default' : 'outline'}
                    size="sm"
                    disabled={s.loading}
                    onClick={() => s.rerun(p.key)}
                    className="text-xs"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {s.loading && (
          <div className="rounded-lg border border-border p-4 flex items-center gap-3">
            <Icon name="Loader2" size={20} className="animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">{s.loadingText || 'Обработка...'}</p>
              <p className="text-[11px] text-muted-foreground">Обычно занимает 20–60 секунд</p>
            </div>
          </div>
        )}
      </DialogContent>

      <PhotoBankPicker
        open={s.showPicker}
        onOpenChange={s.setShowPicker}
        mode="pick"
        onPick={s.handlePickFromBank}
      />

      <PhotoBankPicker
        open={s.showSaver}
        onOpenChange={s.setShowSaver}
        mode="save"
        onSave={s.handleSaveToFolder}
        saveDisabled={s.saving}
      />
    </Dialog>
  );
};

export default SkinRetouchDialog;
