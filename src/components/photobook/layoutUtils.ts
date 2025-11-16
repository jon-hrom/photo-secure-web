import type { PhotobookFormat, PhotoSlot } from './PhotobookCreator';

export const SAFE_MARGIN = 5;
export const DEFAULT_PHOTO_SPACING = 5;

export interface FormatSpecs {
  width: number;
  height: number;
  spreadMM: string;
  spreadPX: string;
  coverMM: string;
  coverPX: string;
  spineMM: string;
  spinePX: string;
  spreadsRange: string;
}

export const SPREAD_SPECS_20x20 = [
  { range: '10-60', spreads: '10-13', spread: '400×203 мм (4724×2398 px)', cover: '457×240 мм (5390×2835 px)', spine: '8 мм (94 px)' },
  { range: '10-60', spreads: '14-17', spread: '400×203 мм (4724×2398 px)', cover: '458×240 мм (5402×2835 px)', spine: '9 мм (106 px)' },
  { range: '10-60', spreads: '18-21', spread: '400×203 мм (4724×2398 px)', cover: '461×240 мм (5445×2835 px)', spine: '12 мм (142 px)' },
  { range: '10-60', spreads: '22-25', spread: '400×203 мм (4724×2398 px)', cover: '463×240 мм (5469×2835 px)', spine: '14 мм (165 px)' },
];

export const FORMAT_SPECS: Record<PhotobookFormat, FormatSpecs> = {
  '20x20': {
    width: 400,
    height: 200,
    spreadMM: '400×203',
    spreadPX: '4724×2398',
    coverMM: '457-463×240',
    coverPX: '5390-5469×2835',
    spineMM: '8-14',
    spinePX: '94-165',
    spreadsRange: 'от 10 до 25'
  },
  '21x30': {
    width: 420,
    height: 300,
    spreadMM: '420×300',
    spreadPX: '4961×3543',
    coverMM: '477×330',
    coverPX: '5634×3898',
    spineMM: '10',
    spinePX: '118',
    spreadsRange: 'стандарт'
  },
  '30x30': {
    width: 600,
    height: 300,
    spreadMM: '600×300',
    spreadPX: '7087×3543',
    coverMM: '657×330',
    coverPX: '7756×3898',
    spineMM: '12',
    spinePX: '142',
    spreadsRange: 'большой'
  }
};

export const getFormatDimensions = (format: PhotobookFormat): { width: number; height: number } => {
  return FORMAT_SPECS[format];
};

export const generateLayout = (
  photosCount: number,
  spreadWidth: number,
  spreadHeight: number,
  spacing: number
): PhotoSlot[] => {
  const slots: PhotoSlot[] = [];
  const safeWidth = spreadWidth - SAFE_MARGIN * 2;
  const safeHeight = spreadHeight - SAFE_MARGIN * 2;
  
  if (photosCount === 0) return slots;
  
  const rows = Math.ceil(Math.sqrt(photosCount));
  const cols = Math.ceil(photosCount / rows);
  
  const totalSpacingWidth = spacing * (cols - 1);
  const totalSpacingHeight = spacing * (rows - 1);
  
  const slotWidth = (safeWidth - totalSpacingWidth) / cols;
  const slotHeight = (safeHeight - totalSpacingHeight) / rows;
  
  for (let i = 0; i < photosCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const isHorizontal = slotWidth > slotHeight;
    
    slots.push({
      id: `slot-${i}`,
      orientation: isHorizontal ? 'horizontal' : 'vertical',
      x: SAFE_MARGIN + col * (slotWidth + spacing),
      y: SAFE_MARGIN + row * (slotHeight + spacing),
      width: slotWidth,
      height: slotHeight,
    });
  }
  
  return slots;
};

export const generateRandomLayout = (
  photosCount: number,
  spreadWidth: number,
  spreadHeight: number,
  spacing: number
): PhotoSlot[] => {
  const slots: PhotoSlot[] = [];
  const safeWidth = spreadWidth - SAFE_MARGIN * 2;
  const safeHeight = spreadHeight - SAFE_MARGIN * 2;
  
  if (photosCount === 0) return slots;
  
  const minSlotSize = Math.min(safeWidth, safeHeight) / 4;
  const maxSlotSize = Math.min(safeWidth, safeHeight) / 2.5;
  
  const attempts = 100;
  
  for (let i = 0; i < photosCount; i++) {
    let placed = false;
    
    for (let attempt = 0; attempt < attempts && !placed; attempt++) {
      const isHorizontal = Math.random() > 0.5;
      const width = minSlotSize + Math.random() * (maxSlotSize - minSlotSize);
      const height = minSlotSize + Math.random() * (maxSlotSize - minSlotSize);
      
      const x = SAFE_MARGIN + Math.random() * (safeWidth - width);
      const y = SAFE_MARGIN + Math.random() * (safeHeight - height);
      
      const hasOverlap = slots.some(existingSlot => {
        const dx = Math.abs((x + width/2) - (existingSlot.x + existingSlot.width/2));
        const dy = Math.abs((y + height/2) - (existingSlot.y + existingSlot.height/2));
        return dx < (width/2 + existingSlot.width/2 + spacing) && 
               dy < (height/2 + existingSlot.height/2 + spacing);
      });
      
      if (!hasOverlap) {
        slots.push({
          id: `slot-${i}`,
          orientation: isHorizontal ? 'horizontal' : 'vertical',
          x,
          y,
          width,
          height,
        });
        placed = true;
      }
    }
    
    if (!placed) {
      return generateLayout(photosCount, spreadWidth, spreadHeight, spacing);
    }
  }
  
  return slots;
};
