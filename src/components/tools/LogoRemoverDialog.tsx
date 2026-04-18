import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import PhotoBankPicker from '@/components/tools/PhotoBankPicker';
import UploadStage from '@/components/tools/logoRemover/UploadStage';
import EditorCanvas from '@/components/tools/logoRemover/EditorCanvas';
import EditorToolbar from '@/components/tools/logoRemover/EditorToolbar';
import { useCanvasState } from '@/components/tools/logoRemover/useCanvasState';
import { useBrushInteractions } from '@/components/tools/logoRemover/useBrushInteractions';
import { useLogoApi } from '@/components/tools/logoRemover/useLogoApi';

interface LogoRemoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LogoRemoverDialog = ({ open, onOpenChange }: LogoRemoverDialogProps) => {
  const s = useCanvasState(open);
  const { onPointerDown, onPointerMove, onPointerUp, onWheel } = useBrushInteractions(s);
  const {
    handleFile,
    handlePickFromBank,
    handleSaveToFolder,
    detectAI,
    inpaint,
    undo,
    download,
  } = useLogoApi(s);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Eraser" size={22} className="text-primary" />
            Убрать лого с фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            AI найдёт лого автоматически — или выделите кистью вручную
          </DialogDescription>
        </DialogHeader>

        {s.stage === 'upload' && (
          <UploadStage
            fileInputRef={s.fileInputRef}
            onFile={handleFile}
            onOpenPicker={() => s.setShowPicker(true)}
          />
        )}

        {s.stage === 'edit' && (
          <div className="mt-3 space-y-3">
            <EditorCanvas
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

            <EditorToolbar
              loading={s.loading}
              hasMask={s.hasMask}
              historyLen={s.historyLen}
              onDetectAI={detectAI}
              onInpaint={inpaint}
              onClearMask={s.clearMask}
              onUndo={undo}
              onDownload={download}
              onOpenSaver={() => s.setShowSaver(true)}
              onReset={s.resetAll}
            />
          </div>
        )}
      </DialogContent>

      <PhotoBankPicker
        open={s.showPicker}
        onOpenChange={s.setShowPicker}
        mode="pick"
        onPick={handlePickFromBank}
      />

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

export default LogoRemoverDialog;
