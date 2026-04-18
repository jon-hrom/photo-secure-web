import { useState, useRef, useCallback, useEffect } from 'react';
import { Stage } from '@/components/tools/logoRemover/utils';

export const useCanvasState = (open: boolean) => {
  const [stage, setStage] = useState<Stage>('upload');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [brushSize, setBrushSize] = useState(30);
  const [hasMask, setHasMask] = useState(false);
  const [historyLen, setHistoryLen] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const [showSaver, setShowSaver] = useState(false);
  const [saving, setSaving] = useState(false);

  const originalDataUrlRef = useRef<string>('');
  const currentDataUrlRef = useRef<string>('');
  const historyRef = useRef<string[]>([]);

  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number; centerX: number; centerY: number; panX: number; panY: number } | null>(null);

  const resetAll = useCallback(() => {
    setStage('upload');
    setLoading(false);
    setLoadingText('');
    setHasMask(false);
    setHistoryLen(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    originalDataUrlRef.current = '';
    currentDataUrlRef.current = '';
    historyRef.current = [];
    pointersRef.current.clear();
    pinchRef.current = null;
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  const clearMask = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const mctx = mask.getContext('2d')!;
    mctx.clearRect(0, 0, mask.width, mask.height);
    setHasMask(false);
  }, []);

  const loadImageIntoCanvas = useCallback(async (dataUrl: string) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
    currentDataUrlRef.current = dataUrl;

    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;
    imgCanvas.width = img.naturalWidth;
    imgCanvas.height = img.naturalHeight;
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;
    const ctx = imgCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    ctx.drawImage(img, 0, 0);
    const mctx = maskCanvas.getContext('2d')!;
    mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasMask(false);
  }, []);

  return {
    stage, setStage,
    loading, setLoading,
    loadingText, setLoadingText,
    brushSize, setBrushSize,
    hasMask, setHasMask,
    historyLen, setHistoryLen,
    zoom, setZoom,
    pan, setPan,
    showPicker, setShowPicker,
    showSaver, setShowSaver,
    saving, setSaving,
    originalDataUrlRef,
    currentDataUrlRef,
    historyRef,
    imageCanvasRef,
    maskCanvasRef,
    fileInputRef,
    viewportRef,
    drawingRef,
    lastPointRef,
    pointersRef,
    pinchRef,
    resetAll,
    resetZoom,
    clearMask,
    loadImageIntoCanvas,
  };
};

export type CanvasState = ReturnType<typeof useCanvasState>;
