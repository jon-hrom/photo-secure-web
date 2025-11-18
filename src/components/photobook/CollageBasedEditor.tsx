import type { PhotobookConfig, UploadedPhoto } from './PhotobookCreator';
import { useCollageEditor } from './editor/useCollageEditor';
import EditorHeader from './editor/EditorHeader';
import ManualModeToolbar from './editor/ManualModeToolbar';
import CollageSelector from './CollageSelector';
import SpreadCanvas from './SpreadCanvas';
import PhotoPanel from './PhotoPanel';

interface CollageBasedEditorProps {
  config: PhotobookConfig;
  photos: UploadedPhoto[];
  onComplete: (spreads: Array<{ id: string; slots: any[] }>) => void;
  onBack: () => void;
}

const CollageBasedEditor = ({ config, photos, onComplete, onBack }: CollageBasedEditorProps) => {
  const {
    photosPerCollage,
    setPhotosPerCollage,
    manualMode,
    selectedSlotIndex,
    isResizing,
    isShiftPressed,
    isDetectingFaces,
    facesDetected,
    spreads,
    selectedSpreadIndex,
    dimensions,
    spinePosition,
    spineWidth,
    getCurrentCollages,
    handleCollageSelect,
    handlePrevSpread,
    handleNextSpread,
    handleSpreadClick,
    handleSlotMouseDown,
    handleResizeMouseDown,
    handleMouseMove,
    handleMouseUp,
    handlePhotoSelect,
    handleDeleteSlot,
    handleAddSlot,
    handleClearPhoto,
    handleDuplicateSlot,
    handleAutoFill,
    handleToggleManualMode
  } = useCollageEditor({ config, photos });

  const handleComplete = () => {
    onComplete(spreads.map(s => ({ id: s.id, slots: s.slots })));
  };

  const selectedSpread = spreads[selectedSpreadIndex];
  const collages = getCurrentCollages();

  return (
    <div className="h-screen md:h-[90vh] flex flex-col p-2 md:p-6 overflow-hidden">
      <EditorHeader
        onBack={onBack}
        onAutoFill={handleAutoFill}
        isDetectingFaces={isDetectingFaces}
        facesDetected={facesDetected}
        manualMode={manualMode}
        onToggleManualMode={handleToggleManualMode}
        onComplete={handleComplete}
      />
      
      {manualMode && (
        <ManualModeToolbar
          selectedSlotIndex={selectedSlotIndex}
          isResizing={isResizing}
          isShiftPressed={isShiftPressed}
          onAddSlot={handleAddSlot}
          onDuplicateSlot={handleDuplicateSlot}
          onClearPhoto={handleClearPhoto}
          onDeleteSlot={handleDeleteSlot}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-2 md:gap-4 flex-1 overflow-hidden">
        <div className="lg:hidden mb-2">
          <CollageSelector
            photosPerCollage={photosPerCollage}
            onPhotosPerCollageChange={setPhotosPerCollage}
            collages={collages}
            selectedCollageId={selectedSpread.collageId}
            onCollageSelect={handleCollageSelect}
          />
        </div>

        <div className="hidden lg:block">
          <CollageSelector
            photosPerCollage={photosPerCollage}
            onPhotosPerCollageChange={setPhotosPerCollage}
            collages={collages}
            selectedCollageId={selectedSpread.collageId}
            onCollageSelect={handleCollageSelect}
          />
        </div>

        <SpreadCanvas
          spreads={spreads}
          selectedSpreadIndex={selectedSpreadIndex}
          photos={photos}
          dimensions={dimensions}
          spinePosition={spinePosition}
          spineWidth={spineWidth}
          manualMode={manualMode}
          selectedSlotIndex={selectedSlotIndex}
          onPrevSpread={handlePrevSpread}
          onNextSpread={handleNextSpread}
          onSpreadClick={handleSpreadClick}
          onSlotMouseDown={handleSlotMouseDown}
          onResizeMouseDown={handleResizeMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          showRulers={true}
        />

        {manualMode && (
          <div className="lg:block hidden">
            <PhotoPanel
              photos={photos}
              onPhotoSelect={handlePhotoSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CollageBasedEditor;