import { useState, useEffect } from 'react';
import type { PhotobookConfig, UploadedPhoto } from '../PhotobookCreator';
import { getFormatDimensions } from '../layoutUtils';
import { COLLAGES_1_PHOTO, COLLAGES_2_PHOTO, COLLAGES_3_PHOTO, COLLAGES_4_PHOTO } from '../collageTemplates';

export interface CollageSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  photoId?: string;
}

export interface CollageTemplate {
  id: string;
  slots: Omit<CollageSlot, 'photoId'>[];
  thumbnail: string;
}

export interface Spread {
  id: string;
  type: 'cover' | 'spread';
  collageId: string;
  slots: CollageSlot[];
}

interface UseCollageEditorProps {
  config: PhotobookConfig;
  photos: UploadedPhoto[];
}

export const useCollageEditor = ({ config, photos }: UseCollageEditorProps) => {
  const [photosPerCollage, setPhotosPerCollage] = useState<1 | 2 | 3 | 4>(1);
  const [manualMode, setManualMode] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isDetectingFaces, setIsDetectingFaces] = useState(false);
  const [facesDetected, setFacesDetected] = useState(false);
  
  const [spreads, setSpreads] = useState<Spread[]>(() => {
    const initialSpreads: Spread[] = [];
    initialSpreads.push({
      id: 'cover',
      type: 'cover',
      collageId: COLLAGES_1_PHOTO[0].id,
      slots: COLLAGES_1_PHOTO[0].slots.map(s => ({ ...s }))
    });
    
    for (let i = 0; i < config.spreadsCount; i++) {
      initialSpreads.push({
        id: `spread-${i}`,
        type: 'spread',
        collageId: COLLAGES_1_PHOTO[0].id,
        slots: COLLAGES_1_PHOTO[0].slots.map(s => ({ ...s }))
      });
    }
    
    return initialSpreads;
  });
  const [selectedSpreadIndex, setSelectedSpreadIndex] = useState(0);

  const dimensions = getFormatDimensions(config.format);
  const spinePosition = dimensions.width;
  const spineWidth = 10;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getCurrentCollages = (): CollageTemplate[] => {
    if (photosPerCollage === 1) return COLLAGES_1_PHOTO;
    if (photosPerCollage === 2) return COLLAGES_2_PHOTO;
    if (photosPerCollage === 3) return COLLAGES_3_PHOTO;
    return COLLAGES_4_PHOTO;
  };

  const handleCollageSelect = (collageId: string) => {
    const collages = getCurrentCollages();
    const collage = collages.find(c => c.id === collageId);
    if (!collage) return;

    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        collageId,
        slots: collage.slots.map(s => ({ ...s }))
      };
    }));
  };

  const handlePrevSpread = () => {
    setSelectedSpreadIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextSpread = () => {
    setSelectedSpreadIndex(prev => Math.min(spreads.length - 1, prev + 1));
  };

  const handleSpreadClick = (index: number) => {
    setSelectedSpreadIndex(index);
  };

  const handleSlotMouseDown = (e: React.MouseEvent<SVGRectElement>, slotIndex: number) => {
    if (!manualMode) return;
    e.stopPropagation();
    
    setSelectedSlotIndex(slotIndex);
    setIsDragging(true);
    
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const scaleX = (dimensions.width * 2) / rect.width;
    const scaleY = dimensions.height / rect.height;
    
    setDragStart({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, slotIndex: number, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    if (!manualMode) return;
    e.stopPropagation();
    
    setSelectedSlotIndex(slotIndex);
    setIsResizing(true);
    setResizeCorner(corner);
    
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const scaleX = (dimensions.width * 2) / rect.width;
    const scaleY = dimensions.height / rect.height;
    
    setDragStart({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!manualMode || (!isDragging && !isResizing) || !dragStart) return;
    
    const svg = e.currentTarget;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const scaleX = (dimensions.width * 2) / rect.width;
    const scaleY = dimensions.height / rect.height;
    
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;
    
    const deltaX = currentX - dragStart.x;
    const deltaY = currentY - dragStart.y;
    
    if (isDragging && selectedSlotIndex !== null) {
      setSpreads(prev => prev.map((spread, idx) => {
        if (idx !== selectedSpreadIndex) return spread;
        
        return {
          ...spread,
          slots: spread.slots.map((slot, slotIdx) => {
            if (slotIdx !== selectedSlotIndex) return slot;
            
            const newX = Math.max(20, Math.min(slot.x + deltaX, dimensions.width * 2 - 20 - slot.width));
            const newY = Math.max(20, Math.min(slot.y + deltaY, dimensions.height - 20 - slot.height));
            
            return { ...slot, x: newX, y: newY };
          })
        };
      }));
    }
    
    if (isResizing && selectedSlotIndex !== null && resizeCorner) {
      setSpreads(prev => prev.map((spread, idx) => {
        if (idx !== selectedSpreadIndex) return spread;
        
        return {
          ...spread,
          slots: spread.slots.map((slot, slotIdx) => {
            if (slotIdx !== selectedSlotIndex) return slot;
            
            let newX = slot.x;
            let newY = slot.y;
            let newWidth = slot.width;
            let newHeight = slot.height;
            
            if (isShiftPressed) {
              const aspectRatio = slot.width / slot.height;
              
              if (resizeCorner === 'br') {
                newWidth = Math.max(50, slot.width + deltaX);
                newHeight = newWidth / aspectRatio;
              } else if (resizeCorner === 'bl') {
                newX = slot.x + deltaX;
                newWidth = Math.max(50, slot.width - deltaX);
                newHeight = newWidth / aspectRatio;
              } else if (resizeCorner === 'tr') {
                newWidth = Math.max(50, slot.width + deltaX);
                newHeight = newWidth / aspectRatio;
                newY = slot.y + slot.height - newHeight;
              } else if (resizeCorner === 'tl') {
                newX = slot.x + deltaX;
                newWidth = Math.max(50, slot.width - deltaX);
                newHeight = newWidth / aspectRatio;
                newY = slot.y + slot.height - newHeight;
              }
            } else {
              if (resizeCorner === 'br') {
                newWidth = Math.max(50, slot.width + deltaX);
                newHeight = Math.max(50, slot.height + deltaY);
              } else if (resizeCorner === 'bl') {
                newX = slot.x + deltaX;
                newWidth = Math.max(50, slot.width - deltaX);
                newHeight = Math.max(50, slot.height + deltaY);
              } else if (resizeCorner === 'tr') {
                newY = slot.y + deltaY;
                newWidth = Math.max(50, slot.width + deltaX);
                newHeight = Math.max(50, slot.height - deltaY);
              } else if (resizeCorner === 'tl') {
                newX = slot.x + deltaX;
                newY = slot.y + deltaY;
                newWidth = Math.max(50, slot.width - deltaX);
                newHeight = Math.max(50, slot.height - deltaY);
              }
            }
            
            return { ...slot, x: newX, y: newY, width: newWidth, height: newHeight };
          })
        };
      }));
    }
    
    setDragStart({ x: currentX, y: currentY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeCorner(null);
    setDragStart(null);
  };

  const handlePhotoSelect = (photoId: string) => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: spread.slots.map((slot, slotIdx) => {
          if (slotIdx !== selectedSlotIndex) return slot;
          return { ...slot, photoId };
        })
      };
    }));
  };

  const handleDeleteSlot = () => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: spread.slots.filter((_, slotIdx) => slotIdx !== selectedSlotIndex)
      };
    }));
    
    setSelectedSlotIndex(null);
  };

  const handleAddSlot = () => {
    if (!manualMode) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: [...spread.slots, {
          x: 100,
          y: 100,
          width: 200,
          height: 200
        }]
      };
    }));
  };

  const handleClearPhoto = () => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      return {
        ...spread,
        slots: spread.slots.map((slot, slotIdx) => {
          if (slotIdx !== selectedSlotIndex) return slot;
          return { ...slot, photoId: undefined };
        })
      };
    }));
  };

  const handleDuplicateSlot = () => {
    if (!manualMode || selectedSlotIndex === null) return;
    
    setSpreads(prev => prev.map((spread, idx) => {
      if (idx !== selectedSpreadIndex) return spread;
      
      const slotToDuplicate = spread.slots[selectedSlotIndex];
      const newSlot = {
        ...slotToDuplicate,
        x: slotToDuplicate.x + 20,
        y: slotToDuplicate.y + 20
      };
      
      return {
        ...spread,
        slots: [...spread.slots, newSlot]
      };
    }));
  };

  const handleAutoFill = async () => {
    setIsDetectingFaces(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let photoIndex = 0;
    
    setSpreads(prev => prev.map(spread => ({
      ...spread,
      slots: spread.slots.map(slot => {
        if (photoIndex < photos.length) {
          const photo = photos[photoIndex];
          photoIndex++;
          return { ...slot, photoId: photo.id };
        }
        return slot;
      })
    })));
    
    setIsDetectingFaces(false);
    setFacesDetected(true);
    
    setTimeout(() => setFacesDetected(false), 3000);
  };

  const handleToggleManualMode = () => {
    setManualMode(!manualMode);
    setSelectedSlotIndex(null);
  };

  return {
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
  };
};
