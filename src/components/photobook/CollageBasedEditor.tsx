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
    <div className="h-[90vh] flex flex-col p-6">
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

      <div className="flex gap-4 flex-1 overflow-hidden">
        <CollageSelector
          photosPerCollage={photosPerCollage}
          onPhotosPerCollageChange={setPhotosPerCollage}
          collages={collages}
          selectedCollageId={selectedSpread.collageId}
          onCollageSelect={handleCollageSelect}
        />

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
          <PhotoPanel
            photos={photos}
            onPhotoSelect={handlePhotoSelect}
          />
        )}
      </div>
    </div>
  );
};

export default CollageBasedEditor;
