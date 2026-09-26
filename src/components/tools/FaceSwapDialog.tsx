import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import UploadStage from '@/components/tools/logoRemover/UploadStage';
import EditorCanvas from '@/components/tools/logoRemover/EditorCanvas';
import { useCanvasState, CanvasState } from '@/components/tools/logoRemover/useCanvasState';
import { useBrushInteractions } from '@/components/tools/logoRemover/useBrushInteractions';
import { useFaceSwapApi } from '@/components/tools/faceSwap/useFaceSwapApi';

interface FaceSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Editor = ({ s }: { s: CanvasState }) => {
  const { onPointerDown, onPointerMove, onPointerUp, onWheel } = useBrushInteractions(s);
  return (
    <EditorCanvas
      tool={s.tool}
      setTool={s.setTool}
      viewportRef={s.viewportRef}
      imageCanvasRef={s.imageCanvasRef}
      maskCanvasRef={s.maskCanvasRef}
      pointersRef={s.pointersRef}
      zoom={s.zoom}
      pan={s.pan}
      loading={s.loading}
      loadingText={s.loadingText}
      brushSize={s.brushSize}
      setBrushSize={s.setBrushSize}
      setZoom={s.setZoom}
      resetZoom={s.resetZoom}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
};

const StepBadge = ({ n, title, active, done, onClick }: { n: number; title: string; active: boolean; done: boolean; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
      active ? 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow' : 'bg-muted text-muted-foreground'
    } ${onClick ? 'hover:opacity-90' : 'cursor-default'}`}
  >
    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${active ? 'bg-white/25' : 'bg-background'}`}>
      {done && !active ? <Icon name="Check" size={12} /> : n}
    </span>
    {title}
  </button>
);

const FaceSwapDialog = ({ open, onOpenChange }: FaceSwapDialogProps) => {
  const donor = useCanvasState(open);
  const target = useCanvasState(open);
  const api = useFaceSwapApi(donor, target, open);
  const { step, price } = api;
  const donorReady = donor.stage === 'edit' && donor.hasMask;
  const busy = donor.loading || target.loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Replace" size={22} className="text-primary" />
            Перенос лица
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Лицо с фото-донора органично встанет на другое фото — с тем же светом, ракурсом и в том же стиле
            (фото остаётся фото, рисунок — рисунком)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <StepBadge
            n={1}
            title="Фото-донор"
            active={step === 'donor'}
            done={donorReady}
            onClick={step === 'target' && !busy ? () => api.setStep('donor') : undefined}
          />
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
          <StepBadge
            n={2}
            title="Куда вставить"
            active={step === 'target'}
            done={false}
            onClick={step === 'donor' && donorReady && !busy ? api.goToTarget : undefined}
          />
        </div>


        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Что переносить:</span>
          {[
            { v: true, label: 'Лицо + волосы', hint: 'максимальная узнаваемость' },
            { v: false, label: 'Только лицо', hint: 'причёска останется как на фото 2' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              disabled={busy}
              onClick={() => api.setWithHair(o.v)}
              title={o.hint}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                api.withHair === o.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* ШАГ 1 — донор. Держим смонтированным, чтобы маска не терялась при переключении шагов. */}
        <div className={step === 'donor' ? '' : 'hidden'}>
          {donor.stage === 'upload' && (
            <>
              <p className="text-sm font-medium mt-3 px-1">Загрузите фото, <b>с которого</b> берём лицо</p>
              <UploadStage
                fileInputRef={donor.fileInputRef}
                onFile={api.donorLoader.handleFile}
                onOpenPicker={() => donor.setShowPicker(true)}
              />
            </>
          )}
          {donor.stage === 'edit' && (
            <div className="mt-3 space-y-3">
              <Editor s={donor} />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={api.goToTarget}
                  disabled={busy || !donor.hasMask}
                  size="sm"
                  className="gap-1.5 bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white hover:opacity-90"
                >
                  Далее: куда вставить
                  <Icon name="ArrowRight" size={16} />
                </Button>
                <Button onClick={donor.clearMask} disabled={busy || !donor.hasMask} variant="outline" size="sm" className="gap-1.5">
                  <Icon name="X" size={16} />
                  Очистить кисть
                </Button>
                <Button onClick={donor.resetAll} disabled={busy} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                  <Icon name="RotateCcw" size={16} />
                  Другое фото
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                Закрасьте кистью лицо, которое нужно перенести (лоб, глаза, нос, рот, подбородок). Волосы закрашивать не нужно — в режиме «Лицо + волосы» причёска возьмётся автоматически. Если на фото несколько
                людей — отметьте только нужного. ПКМ или Ctrl — ластик маски.
              </p>
            </div>
          )}
        </div>

        {/* ШАГ 2 — целевое фото */}
        <div className={step === 'target' ? '' : 'hidden'}>
          {target.stage === 'upload' && (
            <>
              <p className="text-sm font-medium mt-3 px-1">Загрузите фото или картинку, <b>куда</b> вставить лицо</p>
              <UploadStage
                fileInputRef={target.fileInputRef}
                onFile={api.targetLoader.handleFile}
                onOpenPicker={() => target.setShowPicker(true)}
              />
            </>
          )}
          {target.stage === 'edit' && (
            <div className="mt-3 space-y-3">
              <Editor s={target} />
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex flex-col items-center gap-0.5">
                  <Button
                    onClick={api.swap}
                    disabled={busy || !target.hasMask}
                    size="sm"
                    className="gap-1.5 bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white hover:opacity-90"
                  >
                    <Icon name="Sparkles" size={16} />
                    Перенести лицо
                  </Button>
                  <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-500 inline-flex items-center gap-0.5 leading-none">
                    {price}
                    <Icon name="Zap" size={10} className="fill-current" />
                  </span>
                </div>
                <Button onClick={target.clearMask} disabled={busy || !target.hasMask} variant="outline" size="sm" className="gap-1.5">
                  <Icon name="X" size={16} />
                  Очистить кисть
                </Button>
                <Button onClick={api.undo} disabled={busy || target.historyLen < 2} variant="outline" size="sm" className="gap-1.5">
                  <Icon name="Undo2" size={16} />
                  Отменить
                </Button>
                <Button onClick={api.download} disabled={busy} variant="outline" size="sm" className="gap-1.5">
                  <Icon name="Download" size={16} />
                  Скачать
                </Button>
                <Button onClick={() => target.setShowSaver(true)} disabled={busy} variant="outline" size="sm" className="gap-1.5">
                  <Icon name="Save" size={16} />
                  В фотобанк
                </Button>
                <Button onClick={api.resetAll} disabled={busy} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                  <Icon name="RotateCcw" size={16} />
                  Начать заново
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                Закрасьте лицо, которое нужно заменить. В режиме «Лицо + волосы» заменится и причёска, очки на фото 2 сохранятся. Остальная часть кадра не меняется. Если это рисунок — лицо
                будет нарисовано в том же стиле, если фото — останется фотореалистичным. После результата можно снова
                закрасить и повторить.
              </p>
            </div>
          )}
          {target.stage === 'upload' && (
            <p className="text-[11px] text-muted-foreground px-1 mt-2">{price} ⚡ за один перенос.</p>
          )}
        </div>
      </DialogContent>

      <PhotoBankPicker open={donor.showPicker} onOpenChange={donor.setShowPicker} mode="pick" onPick={api.donorLoader.handlePickFromBank} />
      <PhotoBankPicker open={target.showPicker} onOpenChange={target.setShowPicker} mode="pick" onPick={api.targetLoader.handlePickFromBank} />
      <PhotoBankPicker
        open={target.showSaver}
        onOpenChange={target.setShowSaver}
        mode="save"
        onSave={api.handleSaveToFolder}
        saveDisabled={target.saving}
      />
    </Dialog>
  );
};

export default FaceSwapDialog;
