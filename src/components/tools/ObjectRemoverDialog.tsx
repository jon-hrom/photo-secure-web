import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import UploadStage from '@/components/tools/logoRemover/UploadStage';
import EditorCanvas from '@/components/tools/logoRemover/EditorCanvas';
import { useCanvasState } from '@/components/tools/logoRemover/useCanvasState';
import { useBrushInteractions } from '@/components/tools/logoRemover/useBrushInteractions';
import { useObjectApi } from '@/components/tools/objectRemover/useObjectApi';

interface ObjectRemoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ObjectRemoverDialog = ({ open, onOpenChange }: ObjectRemoverDialogProps) => {
  const s = useCanvasState(open);
  const { onPointerDown, onPointerMove, onPointerUp, onWheel } = useBrushInteractions(s);
  const { handleFile, handlePickFromBank, handleSaveToFolder, removeObjects, undo, download } = useObjectApi(s);
  const price = s.estimate?.price ?? 25;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="ScanEye" size={22} className="text-primary" />
            Удалить объект с фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Закрасьте кистью лишних людей или предметы — AI дорисует фон так, будто их не было
          </DialogDescription>
        </DialogHeader>

        {s.stage === 'upload' && (
          <>
            <UploadStage
              fileInputRef={s.fileInputRef}
              onFile={handleFile}
              onOpenPicker={() => s.setShowPicker(true)}
            />
            <p className="text-[11px] text-muted-foreground px-1">
              {price} ⚡ за одно удаление. Можно выделить сразу несколько объектов — они уберутся за один раз.
            </p>
          </>
        )}

        {s.stage === 'edit' && (
          <div className="mt-3 space-y-3">
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

            <div className="flex flex-wrap items-start gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <Button
                  onClick={removeObjects}
                  disabled={s.loading || !s.hasMask}
                  size="sm"
                  className="gap-1.5 bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:opacity-90"
                >
                  <Icon name="Sparkles" size={16} />
                  Удалить выделенное
                </Button>
                <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-500 inline-flex items-center gap-0.5 leading-none">
                  {price}
                  <Icon name="Zap" size={10} className="fill-current" />
                </span>
              </div>
              <Button onClick={s.clearMask} disabled={s.loading || !s.hasMask} variant="outline" size="sm" className="gap-1.5">
                <Icon name="X" size={16} />
                Очистить кисть
              </Button>
              <Button onClick={undo} disabled={s.loading || s.historyLen < 2} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Undo2" size={16} />
                Отменить
              </Button>
              <Button onClick={download} disabled={s.loading} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Download" size={16} />
                Скачать
              </Button>
              <Button onClick={() => s.setShowSaver(true)} disabled={s.loading} variant="outline" size="sm" className="gap-1.5">
                <Icon name="Save" size={16} />
                В фотобанк
              </Button>
              <Button onClick={s.resetAll} disabled={s.loading} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                <Icon name="RotateCcw" size={16} />
                Новое фото
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground px-1">
              Закрашивайте объект целиком, с небольшим запасом — вместе с тенью и краями. ПКМ или Ctrl — ластик маски.
              Два пальца или Ctrl+колесо — масштаб. Остальная часть фото не меняется.
            </p>
          </div>
        )}
      </DialogContent>

      <PhotoBankPicker open={s.showPicker} onOpenChange={s.setShowPicker} mode="pick" onPick={handlePickFromBank} />
      <PhotoBankPicker
        open={s.showSaver}
        onOpenChange={s.setShowSaver}
        mode="save"
        onSave={handleSaveToFolder}
        saveDisabled={s.saving}
      />
    </Dialog>
  );
};

export default ObjectRemoverDialog;
