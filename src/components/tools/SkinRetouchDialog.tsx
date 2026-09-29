import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import UploadStage from '@/components/tools/skinRetouch/UploadStage';
import CompareView from '@/components/tools/skinRetouch/CompareView';
import ChinToggle from '@/components/tools/skinRetouch/ChinToggle';
import PlasticPanel from '@/components/tools/skinRetouch/PlasticPanel';
import EyeSharpenSelector from '@/components/tools/skinRetouch/EyeSharpenSelector';
import SlimBrushEditor from '@/components/tools/skinRetouch/SlimBrushEditor';
import { useSlimMask } from '@/components/tools/skinRetouch/useSlimMask';
import { usePlasticParams, useLivePlastic } from '@/components/tools/skinRetouch/plastic';
import { useRetouchApi } from '@/components/tools/skinRetouch/useRetouchApi';
import { PRESETS, EYE_SHARPEN_OPTIONS } from '@/components/tools/skinRetouch/utils';

interface SkinRetouchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SkinRetouchDialog = ({ open, onOpenChange }: SkinRetouchDialogProps) => {
  const mask = useSlimMask();
  // Маска кисти уходит в генеративную модель вместе с ретушью
  const maskRef = useRef(mask);
  maskRef.current = mask;
  const s = useRetouchApi(open, () => (maskRef.current.hasPaint ? maskRef.current.canvas : null));
  const { params: plastic, setParams: setPlastic } = usePlasticParams();
  const [setupPreview, setSetupPreview] = useState('');

  // Маска рисуется в разрешении загруженного фото — сбрасываем её на новом фото.
  const { init: initMask } = mask;
  useEffect(() => {
    setSetupPreview('');
    if (!s.originalUrl) return;
    const img = new Image();
    img.onload = () => initMask(img.naturalWidth, img.naturalHeight);
    img.src = s.originalUrl;
  }, [s.originalUrl, initMask]);

  // Одна живая пластика: на этапе настроек — по оригиналу (предпросмотр),
  // после ретуши — по результату AI.
  const liveBase = s.stage === 'result' ? s.baseResultUrl : s.stage === 'setup' ? s.originalUrl : '';
  const live = useLivePlastic(
    liveBase,
    plastic,
    (url) => (s.stage === 'result' ? s.setResultUrl(url) : setSetupPreview(url)),
    null,
    0,
  );
  const liveBusy = live.status === 'applying' || live.status === 'detecting';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-[98vw] sm:max-w-3xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Sparkles" size={22} className="text-primary" />
            Ретушь фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Загрузите фото, настройте ретушь, пластику и кисть «Похудеть» — затем нажмите «Ретушь»
          </DialogDescription>
        </DialogHeader>

        {s.stage === 'upload' && !s.loading && (
          <UploadStage
            fileInputRef={s.fileInputRef}
            price={s.price}
            onFile={s.handleFile}
            onOpenPicker={() => s.setShowPicker(true)}
          />
        )}

        {s.stage === 'setup' && s.originalUrl && (
          <div className="mt-3 space-y-3">
            <SlimBrushEditor
              imageUrl={s.originalUrl}
              previewUrl={setupPreview}
              mask={mask}
              disabled={s.loading}
              busy={liveBusy}
              aiNote={s.slimPrice}
            />

            <PlasticPanel
              value={plastic}
              onChange={setPlastic}
              disabled={s.loading}
              status={live.status}
              found={live.found}
              hint="Предпросмотр — во вкладке «Результат» над фото. Пластика и кисть применятся к фото после ретуши."
            />

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div>
                <p className="text-xs font-medium mb-2">Сила ретуши кожи</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      disabled={s.loading}
                      onClick={() => s.setPreset(p.key)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
                        s.preset === p.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {PRESETS.find((p) => p.key === s.preset)?.hint}
                </p>
              </div>
              <EyeSharpenSelector value={s.eyeSharpen} onChange={s.setEyeSharpen} disabled={s.loading} />
              <ChinToggle value={s.removeChin} onChange={s.setRemoveChin} disabled={s.loading} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={s.startRetouch}
                disabled={s.loading || liveBusy}
                className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 px-6"
              >
                <Icon name="Sparkles" size={18} />
                Ретушь
                {s.price !== null && (
                  <span className="inline-flex items-center gap-0.5 text-xs opacity-90">
                    · {s.price + (mask.hasPaint ? s.slimPrice ?? 0 : 0)}
                    <Icon name="Zap" size={12} className="fill-current" />
                  </span>
                )}
              </Button>
              <Button onClick={s.reset} disabled={s.loading} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                <Icon name="RotateCcw" size={16} />
                Другое фото
              </Button>
            </div>
          </div>
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
              <Button onClick={s.download} disabled={s.loading || liveBusy} size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
                <Icon name="Download" size={16} />
                Скачать
              </Button>
              <Button onClick={() => s.setShowSaver(true)} disabled={s.loading || s.saving || liveBusy} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Save" size={16} />
                В фотобанк
              </Button>
              <Button onClick={s.backToSetup} disabled={s.loading} variant="outline" size="sm" className="gap-1.5">
                <Icon name="SlidersHorizontal" size={16} />
                К настройкам
              </Button>
              <Button onClick={s.reset} disabled={s.loading} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                <Icon name="RotateCcw" size={16} />
                Новое фото
              </Button>
            </div>

            <PlasticPanel
              value={plastic}
              onChange={setPlastic}
              disabled={s.loading}
              status={live.status}
              found={live.found}
            />

            {mask.hasPaint && (
              <p className="text-[11px] text-muted-foreground px-1">
                Пластика по маске уже сделана AI. Чтобы изменить маску — «К настройкам» и снова «Ретушь».
              </p>
            )}

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
              <div className="mb-2">
                <ChinToggle compact value={s.removeChin} onChange={s.setRemoveChin} disabled={s.loading} />
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
