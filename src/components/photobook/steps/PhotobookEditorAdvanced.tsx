import { useState, useEffect } from 'react';
import type { PhotobookConfig, UploadedPhoto, PhotoSlot } from '../PhotobookCreator';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useAutoSave } from '@/hooks/useAutoSave';
import EditorTopToolbar from '../editor/EditorTopToolbar';
import EditorLeftPanel from '../editor/EditorLeftPanel';
import EditorCanvas from '../editor/EditorCanvas';
import EditorBottomThumbnails from '../editor/EditorBottomThumbnails';
import FrameSelector from '../FrameSelector';
import CropTool from '../CropTool';
import TransparencyTool from '../TransparencyTool';
import StyleSelector from '../StyleSelector';
import HistoryPanel from '../HistoryPanel';

interface Spread {
  id: string;
  type: 'cover' | 'spread';
  slots: PhotoSlot[];
}

interface PhotobookEditorAdvancedProps {
  config: PhotobookConfig;
  photos: UploadedPhoto[];
  onComplete: (spreads: Spread[]) => void;
  onBack: () => void;
}

interface DraggablePhoto {
  slotId: string;
  photoId: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  opacity?: number;
  filter?: string;
  frameId?: string | null;
}

const PhotobookEditorAdvanced = ({ config, photos, onComplete, onBack }: PhotobookEditorAdvancedProps) => {
  const initialSpreads: Spread[] = [
    {
      id: 'cover',
      type: 'cover',
      slots: [
        { id: 'cover-slot', orientation: 'horizontal', x: 50, y: 50, width: 700, height: 500, photoId: photos[0]?.id }
      ]
    },
    {
      id: 'spread-1',
      type: 'spread',
      slots: [
        { id: 's1-slot1', orientation: 'horizontal', x: 20, y: 20, width: 380, height: 280, photoId: photos[1]?.id },
        { id: 's1-slot2', orientation: 'vertical', x: 420, y: 20, width: 180, height: 280, photoId: photos[2]?.id },
        { id: 's1-slot3', orientation: 'horizontal', x: 620, y: 20, width: 380, height: 280, photoId: photos[3]?.id },
      ]
    },
    {
      id: 'spread-2',
      type: 'spread',
      slots: [
        { id: 's2-slot1', orientation: 'horizontal', x: 20, y: 20, width: 480, height: 360 },
        { id: 's2-slot2', orientation: 'horizontal', x: 520, y: 20, width: 480, height: 360 },
      ]
    },
  ];

  const savedSpreads = localStorage.getItem('photobook-editor-spreads');
  const initialState = savedSpreads ? JSON.parse(savedSpreads) : initialSpreads;

  const {
    state: spreads,
    setState: setSpreads,
    undo,
    redo,
    canUndo,
    canRedo,
    historySize,
    currentIndex,
  } = useUndoRedo<Spread[]>(initialState, 100);

  const { clearSaved } = useAutoSave(spreads, {
    key: 'photobook-editor-spreads',
    delay: 2000,
    enabled: true
  });

  const savedSpreadIndex = localStorage.getItem('photobook-editor-spread-index');
  const savedAdjustments = localStorage.getItem('photobook-editor-adjustments');

  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(savedSpreadIndex ? parseInt(savedSpreadIndex) : 0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [photoAdjustments, setPhotoAdjustments] = useState<Record<string, DraggablePhoto>>(
    savedAdjustments ? JSON.parse(savedAdjustments) : {}
  );

  useAutoSave(currentSpreadIndex, {
    key: 'photobook-editor-spread-index',
    delay: 1000
  });

  useAutoSave(photoAdjustments, {
    key: 'photobook-editor-adjustments',
    delay: 2000
  });
  const [leftPanelTab, setLeftPanelTab] = useState<'photos' | 'text' | 'templates' | 'bg' | 'collages' | 'stickers' | 'frames'>('photos');
  
  const [showFrameSelector, setShowFrameSelector] = useState(false);
  const [showCropTool, setShowCropTool] = useState(false);
  const [showTransparencyTool, setShowTransparencyTool] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [textToAdd, setTextToAdd] = useState('');

  const currentSpread = spreads[currentSpreadIndex];

  const handleAddPhotoToSlot = (slotId: string, photoId: string) => {
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot =>
        slot.id === slotId ? { ...slot, photoId } : slot
      )
    })));
  };

  const handleRemovePhotoFromSlot = (slotId: string) => {
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot =>
        slot.id === slotId ? { ...slot, photoId: undefined } : slot
      )
    })));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleComplete = () => {
    clearSaved();
    localStorage.removeItem('photobook-editor-spread-index');
    localStorage.removeItem('photobook-editor-adjustments');
    onComplete(spreads);
  };

  const getPhotoForSlot = (slotId: string) => {
    const slot = currentSpread.slots.find(s => s.id === slotId);
    if (!slot?.photoId) return null;
    return photos.find(p => p.id === slot.photoId);
  };

  const handleToolFrame = () => {
    if (selectedSlot) {
      setShowFrameSelector(true);
    }
  };

  const handleToolCrop = () => {
    if (selectedSlot) {
      setShowCropTool(true);
    }
  };

  const handleToolTransparency = () => {
    if (selectedSlot) {
      setShowTransparencyTool(true);
    }
  };

  const handleToolStyle = () => {
    if (selectedSlot) {
      setShowStyleSelector(true);
    }
  };

  const handleToolReplace = () => {
    if (selectedSlot) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const newPhoto: UploadedPhoto = {
              id: `photo-${Date.now()}`,
              url: e.target?.result as string,
              file: file,
              width: 800,
              height: 600
            };
            handleAddPhotoToSlot(selectedSlot, newPhoto.id);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleToolMakeBackground = () => {
    if (selectedSlot) {
      const photo = getPhotoForSlot(selectedSlot);
      if (photo) {
        console.log('Making background from', photo.id);
      }
    }
  };

  const handleToolClear = () => {
    if (selectedSlot) {
      handleRemovePhotoFromSlot(selectedSlot);
    }
  };

  const handleApplyFrame = (frameId: string | null) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          frameId
        }
      }));
    }
  };

  const handleApplyCrop = (crop: { x: number; y: number; width: number; height: number; scale: number }) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          scale: crop.scale,
          offsetX: crop.x,
          offsetY: crop.y
        }
      }));
    }
  };

  const handleApplyOpacity = (opacity: number) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          opacity
        }
      }));
    }
  };

  const handleApplyStyle = (filter: string) => {
    if (selectedSlot) {
      setPhotoAdjustments(prev => ({
        ...prev,
        [selectedSlot]: {
          ...prev[selectedSlot],
          filter
        }
      }));
    }
  };

  const selectedPhoto = selectedSlot ? getPhotoForSlot(selectedSlot) : null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <EditorTopToolbar
        config={config}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        currentIndex={currentIndex}
        historySize={historySize}
        onShowHistory={() => setShowHistoryPanel(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <EditorLeftPanel
          photos={photos}
          leftPanelTab={leftPanelTab}
          setLeftPanelTab={setLeftPanelTab}
          textToAdd={textToAdd}
          setTextToAdd={setTextToAdd}
        />

        <EditorCanvas
          currentSpread={currentSpread}
          currentSpreadIndex={currentSpreadIndex}
          spreadsLength={spreads.length}
          selectedSlot={selectedSlot}
          photos={photos}
          photoAdjustments={photoAdjustments}
          onSpreadChange={setCurrentSpreadIndex}
          onSlotSelect={setSelectedSlot}
          onAddPhotoToSlot={handleAddPhotoToSlot}
          onRemovePhotoFromSlot={handleRemovePhotoFromSlot}
          onToolFrame={handleToolFrame}
          onToolReplace={handleToolReplace}
          onToolCrop={handleToolCrop}
          onToolTransparency={handleToolTransparency}
          onToolMakeBackground={handleToolMakeBackground}
          onToolClear={handleToolClear}
          onToolStyle={handleToolStyle}
        />
      </div>

      <EditorBottomThumbnails
        spreads={spreads}
        currentSpreadIndex={currentSpreadIndex}
        onSpreadSelect={setCurrentSpreadIndex}
      />

      {/* Tool Dialogs */}
      {selectedPhoto && (
        <>
          <FrameSelector
            open={showFrameSelector}
            onClose={() => setShowFrameSelector(false)}
            onSelectFrame={handleApplyFrame}
          />
          
          <CropTool
            open={showCropTool}
            onClose={() => setShowCropTool(false)}
            photoUrl={selectedPhoto.url}
            onApply={handleApplyCrop}
          />
          
          <TransparencyTool
            open={showTransparencyTool}
            onClose={() => setShowTransparencyTool(false)}
            photoUrl={selectedPhoto.url}
            currentOpacity={photoAdjustments[selectedSlot!]?.opacity}
            onApply={handleApplyOpacity}
          />
          
          <StyleSelector
            open={showStyleSelector}
            onClose={() => setShowStyleSelector(false)}
            photoUrl={selectedPhoto.url}
            onApplyStyle={handleApplyStyle}
          />
        </>
      )}

      {/* History Panel */}
      <HistoryPanel
        open={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        historySize={historySize}
        currentIndex={currentIndex}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />
    </div>
  );
};

export default PhotobookEditorAdvanced;