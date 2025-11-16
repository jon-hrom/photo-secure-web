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

interface LayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
  occupied: boolean;
}

const generateGridCells = (
  safeWidth: number,
  safeHeight: number,
  cellSize: number
): LayoutCell[][] => {
  const cols = Math.floor(safeWidth / cellSize);
  const rows = Math.floor(safeHeight / cellSize);
  const grid: LayoutCell[][] = [];

  for (let row = 0; row < rows; row++) {
    grid[row] = [];
    for (let col = 0; col < cols; col++) {
      grid[row][col] = {
        x: SAFE_MARGIN + col * cellSize,
        y: SAFE_MARGIN + row * cellSize,
        width: cellSize,
        height: cellSize,
        occupied: false
      };
    }
  }
  
  return grid;
};

const findBestFit = (
  grid: LayoutCell[][],
  minCols: number,
  minRows: number,
  maxCols: number,
  maxRows: number
): { startRow: number; startCol: number; cols: number; rows: number } | null => {
  const gridRows = grid.length;
  const gridCols = grid[0]?.length || 0;

  for (let rows = maxRows; rows >= minRows; rows--) {
    for (let cols = maxCols; cols >= minCols; cols--) {
      for (let startRow = 0; startRow <= gridRows - rows; startRow++) {
        for (let startCol = 0; startCol <= gridCols - cols; startCol++) {
          let canPlace = true;
          
          for (let r = startRow; r < startRow + rows && canPlace; r++) {
            for (let c = startCol; c < startCol + cols && canPlace; c++) {
              if (grid[r][c].occupied) {
                canPlace = false;
              }
            }
          }
          
          if (canPlace) {
            return { startRow, startCol, cols, rows };
          }
        }
      }
    }
  }
  
  return null;
};

const markOccupied = (
  grid: LayoutCell[][],
  startRow: number,
  startCol: number,
  rows: number,
  cols: number
): void => {
  for (let r = startRow; r < startRow + rows; r++) {
    for (let c = startCol; c < startCol + cols; c++) {
      grid[r][c].occupied = true;
    }
  }
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
  
  const baseCellSize = Math.min(safeWidth, safeHeight) / 6;
  const grid = generateGridCells(safeWidth, safeHeight, baseCellSize);
  
  if (grid.length === 0 || grid[0].length === 0) {
    return generateLayout(photosCount, spreadWidth, spreadHeight, spacing);
  }

  const photoSizes = [];
  for (let i = 0; i < photosCount; i++) {
    const isLarge = Math.random() < 0.3;
    const isHorizontal = Math.random() > 0.4;
    
    if (isLarge) {
      photoSizes.push({
        minCols: isHorizontal ? 3 : 2,
        minRows: isHorizontal ? 2 : 3,
        maxCols: isHorizontal ? 4 : 3,
        maxRows: isHorizontal ? 3 : 4,
        orientation: isHorizontal ? 'horizontal' : 'vertical'
      });
    } else {
      photoSizes.push({
        minCols: 2,
        minRows: 2,
        maxCols: 3,
        maxRows: 3,
        orientation: isHorizontal ? 'horizontal' : 'vertical'
      });
    }
  }
  
  photoSizes.sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < photosCount; i++) {
    const size = photoSizes[i];
    const fit = findBestFit(grid, size.minCols, size.minRows, size.maxCols, size.maxRows);
    
    if (fit) {
      const x = grid[fit.startRow][fit.startCol].x;
      const y = grid[fit.startRow][fit.startCol].y;
      const width = fit.cols * baseCellSize - spacing;
      const height = fit.rows * baseCellSize - spacing;
      
      slots.push({
        id: `slot-${i}`,
        orientation: size.orientation as 'horizontal' | 'vertical',
        x,
        y,
        width,
        height,
      });
      
      markOccupied(grid, fit.startRow, fit.startCol, fit.rows, fit.cols);
    } else {
      const smallFit = findBestFit(grid, 1, 1, 2, 2);
      if (smallFit) {
        const x = grid[smallFit.startRow][smallFit.startCol].x;
        const y = grid[smallFit.startRow][smallFit.startCol].y;
        const width = smallFit.cols * baseCellSize - spacing;
        const height = smallFit.rows * baseCellSize - spacing;
        
        slots.push({
          id: `slot-${i}`,
          orientation: width > height ? 'horizontal' : 'vertical',
          x,
          y,
          width,
          height,
        });
        
        markOccupied(grid, smallFit.startRow, smallFit.startCol, smallFit.rows, smallFit.cols);
      }
    }
  }
  
  return slots;
};