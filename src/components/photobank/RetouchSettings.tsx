import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Photo,
  buildPreviewFilter, getPhotoPreviewUrl,
} from './retouchTypes';
import BeforeAfterPreview from './BeforeAfterPreview';
import PhotoPickerModal from './PhotoPickerModal';
import AIToolsPanel from './AIToolsPanel';
import ManualSlidersPanel from './ManualSlidersPanel';
import RetouchActionButtons from './RetouchActionButtons';
import { useRetouchPreset } from './retouch/useRetouchPreset';
import { useRetouchTesting } from './retouch/useRetouchTesting';
import { useRetouchPlugins } from './retouch/useRetouchPlugins';
import { useMaskPreview } from './retouch/useMaskPreview';

interface RetouchSettingsProps {
  userId: string;
  onBack: () => void;
  previewPhoto?: Photo | null;
  photos?: Photo[];
}

const RetouchSettings = ({ userId, onBack, previewPhoto, photos = [] }: RetouchSettingsProps) => {
  const [currentPreviewPhoto, setCurrentPreviewPhoto] = useState<Photo | null>(previewPhoto || null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [aiToolsExpanded, setAiToolsExpanded] = useState(true);

  const plugins = useRetouchPlugins({
    userId,
    currentPreviewPhotoId: currentPreviewPhoto?.id,
    setRetouchedUrl: (u) => testing.setRetouchedUrl(u),
  });

  const preset = useRetouchPreset({
    userId,
    onBack,
    selectedPlugins: plugins.selectedPlugins,
    setSelectedPlugins: plugins.setSelectedPlugins,
    setRetouchedUrl: (u) => testing.setRetouchedUrl(u),
  });

  const testing = useRetouchTesting({
    userId,
    currentPreviewPhotoId: currentPreviewPhoto?.id,
    autoMode: preset.autoMode,
    ops: preset.ops,
  });

  const maskPreview = useMaskPreview({
    userId,
    currentPreviewPhotoId: currentPreviewPhoto?.id,
  });

  useEffect(() => {
    if (previewPhoto && !currentPreviewPhoto) {
      setCurrentPreviewPhoto(previewPhoto);
    }
  }, [previewPhoto]);

  useEffect(() => {
    testing.setRetouchedUrl(null);
  }, [currentPreviewPhoto?.id]);

  const filterStr = useMemo(() => buildPreviewFilter(preset.ops), [preset.ops]);

  const previewSrc = currentPreviewPhoto ? getPhotoPreviewUrl(currentPreviewPhoto) : '';

  if (preset.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={onBack}>
            <Icon name="ArrowLeft" size={16} />
          </Button>
          <h3 className="font-medium text-xs sm:text-sm flex-1">Настройки ретуши</h3>
          {photos.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowPhotoPicker(true)}
            >
              <Icon name="Images" size={12} className="mr-1" />
              Сменить фото
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="lg:flex-1 min-w-0 space-y-2">
            <BeforeAfterPreview
              src={previewSrc}
              filterStr={filterStr}
              retouchedSrc={testing.retouchedUrl || undefined}
              maskOverlaySrc={maskPreview.showMaskPreview ? maskPreview.maskPreviewUrl : null}
              maskLoading={maskPreview.showMaskPreview && maskPreview.maskPreviewLoading}
            />
            {previewSrc && (
              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/60 bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={maskPreview.showMaskPreview}
                  onChange={(e) => maskPreview.setShowMaskPreview(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border accent-red-500 cursor-pointer"
                />
                <Icon name="ScanFace" size={14} className="text-red-500" />
                <span className="text-[11px] sm:text-xs flex-1">
                  Предпросмотр маски
                  <span className="text-muted-foreground ml-1">— где уберутся дефекты</span>
                </span>
                {maskPreview.showMaskPreview && maskPreview.maskPreviewLoading && (
                  <Icon name="Loader2" size={12} className="animate-spin text-muted-foreground" />
                )}
              </label>
            )}
          </div>

          <div className="lg:w-64 xl:w-72 flex-shrink-0">
            <div className="max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] overflow-y-auto pr-0.5 space-y-2 overscroll-contain">
              <AIToolsPanel
                aiToolsExpanded={aiToolsExpanded}
                setAiToolsExpanded={setAiToolsExpanded}
                selectedPlugins={plugins.selectedPlugins}
                togglePlugin={plugins.togglePlugin}
                showMaskEditor={plugins.showMaskEditor}
                previewSrc={previewSrc}
                brushSize={plugins.brushSize}
                setBrushSize={plugins.setBrushSize}
                runningPlugins={plugins.runningPlugins}
                pluginProgress={plugins.pluginProgress}
                currentPreviewPhotoId={currentPreviewPhoto?.id}
                onRunPlugins={plugins.handleRunPlugins}
                maskCanvasRef={plugins.maskCanvasRef}
                maskDrawing={plugins.maskDrawing}
              />
              <ManualSlidersPanel
                autoMode={preset.autoMode}
                toggleAutoMode={preset.toggleAutoMode}
                ops={preset.ops}
                toggleOp={preset.toggleOp}
                updateParam={preset.updateParam}
                moveOp={preset.moveOp}
                reorderMode={reorderMode}
                setReorderMode={setReorderMode}
                slidersExpanded={preset.slidersExpanded}
                setSlidersExpanded={preset.setSlidersExpanded}
              />
              <RetouchActionButtons
                previewSrc={previewSrc}
                testingRetouch={testing.testingRetouch}
                currentPreviewPhotoId={currentPreviewPhoto?.id}
                autoMode={preset.autoMode}
                saving={preset.saving}
                onTestRetouch={testing.handleTestRetouch}
                onSave={preset.handleSave}
                onReset={preset.handleReset}
              />
            </div>
          </div>
        </div>
      </div>

      {photos.length > 1 && (
        <PhotoPickerModal
          open={showPhotoPicker}
          onOpenChange={setShowPhotoPicker}
          photos={photos}
          selectedId={currentPreviewPhoto?.id || null}
          onSelect={setCurrentPreviewPhoto}
        />
      )}
    </>
  );
};

export default RetouchSettings;
